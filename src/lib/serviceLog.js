import { supabase } from './supabaseClient'
import { BUILD } from './build'

/**
 * Службові дані для модератора: журнал падінь і відгуки з форми.
 *
 * Обидві таблиці читає лише модератор (RLS), пишуть усі. Строки зберігання —
 * 90 днів для падінь і 12 місяців для відгуків
 * (supabase/migrations/20261013_logs_limits_account.sql).
 */

export const ERROR_RETENTION_DAYS = 90
export const FEEDBACK_RETENTION_MONTHS = 12

/** Міграцію 20261013 ще не застосовано: функції чи таблиці немає. */
export class ServiceLogUnavailableError extends Error {}

function isMissing(error) {
  return ['PGRST202', '42883', 'PGRST205', '42P01'].includes(error?.code)
}

// ───────────────────────── Журнал падінь ─────────────────────────

const ERROR_COLUMNS = 'id, occurred_at, user_id, kind, message, stack, path, user_agent'

/**
 * Падіння за останні `days` днів, найновіші спершу. Стеля `limit` — щоб одна
 * погана викладка, що дала тисячі рядків, не повісила адмінку.
 *
 * Колонка build з'являється з міграцією 20261013; до неї журнал читається
 * без версії, а не не читається зовсім.
 */
export async function fetchRecentErrors({ days = 7, limit = 500 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const query = (columns) =>
    supabase
      .from('client_errors')
      .select(columns)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(limit)

  let { data, error } = await query(`${ERROR_COLUMNS}, build`)
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    ;({ data, error } = await query(ERROR_COLUMNS))
  }
  if (error) throw error
  return data ?? []
}

/**
 * Групує падіння за видом і текстом — так само, як клієнт їх дедуплікує
 * (lib/errorLog.js): той самий збій з різних сторінок — одна історія.
 *
 * Рядки мають іти від найновіших до найстаріших (як їх віддає
 * fetchRecentErrors): перший рядок групи — її останній випадок.
 */
export function groupErrors(rows) {
  const groups = new Map()

  for (const row of rows) {
    const key = `${row.kind}:${row.message}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        kind: row.kind,
        message: row.message,
        count: 0,
        lastAt: row.occurred_at,
        firstAt: row.occurred_at,
        paths: [],
        builds: [],
        users: 0,
        latest: row,
        userIds: new Set(),
      }
      groups.set(key, group)
    }

    group.count += 1
    if (row.occurred_at > group.lastAt) {
      group.lastAt = row.occurred_at
      group.latest = row
    }
    if (row.occurred_at < group.firstAt) group.firstAt = row.occurred_at
    if (row.path && !group.paths.includes(row.path)) group.paths.push(row.path)
    if (row.build && !group.builds.includes(row.build)) group.builds.push(row.build)
    if (row.user_id) group.userIds.add(row.user_id)
  }

  return [...groups.values()]
    .map(({ userIds, ...group }) => ({ ...group, users: userIds.size }))
    .sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1))
}

export async function purgeOldErrors(days = ERROR_RETENTION_DAYS) {
  const { data, error } = await supabase.rpc('purge_old_client_errors', { p_days: days })
  if (isMissing(error)) throw new ServiceLogUnavailableError(error.message)
  if (error) throw error
  return data ?? 0
}

// ───────────────────────── Відгуки ─────────────────────────

export const FEEDBACK_KINDS = {
  problem: 'Щось не працює',
  idea: 'Ідея чи побажання',
  accessibility: 'Доступність',
  other: 'Інше',
}

export const FEEDBACK_MAX = 2000
export const CONTACT_MAX = 200

export class FeedbackError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'FeedbackError'
    this.reason = reason
    this.cause = cause
  }
}

export const FEEDBACK_ERROR = {
  EMPTY: 'empty',
  TOO_MANY: 'too_many_attempts',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
}

function safePath() {
  try {
    return window.location.pathname
  } catch {
    return null
  }
}

function safeAgent() {
  try {
    return navigator.userAgent.slice(0, 500)
  } catch {
    return null
  }
}

/**
 * Надсилає відгук. Підписує його користувачем, якщо той увійшов: модератор
 * тоді бачить, з якого боку прийшло (вчитель, батьки, дитина). Гість пише
 * анонімно — і це нормально.
 *
 * `fromPath` — сторінка, з якої людина прийшла до форми: «не працює» без
 * адреси майже ні про що не каже.
 */
export async function sendFeedback({ kind, message, contact, fromPath }) {
  const text = (message ?? '').trim()
  if (!text) throw new FeedbackError(FEEDBACK_ERROR.EMPTY)

  let userId = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    userId = session?.user?.id ?? null
  } catch {
    // Без сесії відгук іде анонімно — це не привід його не надсилати.
  }

  const { error } = await supabase.from('feedback').insert({
    kind: FEEDBACK_KINDS[kind] ? kind : 'other',
    message: text.slice(0, FEEDBACK_MAX),
    contact: (contact ?? '').trim().slice(0, CONTACT_MAX) || null,
    path: (fromPath || safePath() || '').slice(0, 500) || null,
    user_agent: safeAgent(),
    build: BUILD,
    user_id: userId,
  })

  if (!error) return
  if (isMissing(error)) throw new FeedbackError(FEEDBACK_ERROR.UNAVAILABLE, error)
  const parts = [error.details, error.message].filter((part) => typeof part === 'string')
  if (parts.some((part) => part.includes(FEEDBACK_ERROR.TOO_MANY))) {
    throw new FeedbackError(FEEDBACK_ERROR.TOO_MANY, error)
  }
  throw new FeedbackError(FEEDBACK_ERROR.UNKNOWN, error)
}

/**
 * Усі відгуки: нерозібрані спершу, серед них — про доступність (так обіцяє
 * сторінка /accessibility), далі — найновіші спершу.
 */
export async function listFeedback({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, created_at, kind, message, contact, path, build, user_id, resolved_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (isMissing(error)) throw new ServiceLogUnavailableError(error.message)
  if (error) throw error

  const rows = data ?? []
  const open = rows.filter((row) => !row.resolved_at)
  return [
    ...open.filter((row) => row.kind === 'accessibility'),
    ...open.filter((row) => row.kind !== 'accessibility'),
    ...rows.filter((row) => row.resolved_at),
  ]
}

export async function setFeedbackResolved(id, resolved, moderatorId) {
  const { error } = await supabase
    .from('feedback')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? moderatorId : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFeedback(id) {
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) throw error
}
