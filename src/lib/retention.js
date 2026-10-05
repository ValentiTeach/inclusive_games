import { supabase } from './supabaseClient'

/**
 * Строк зберігання даних дитини (supabase/migrations/20261005_data_retention.sql).
 *
 * Дванадцять місяців без жодної гри й жодного заняття — і дані учня більше не
 * потрібні ні йому, ні фахівцю. Строк живе тут і в SQL двічі, і це навмисно:
 * сервер не має покладатися на число з браузера, а сторінка не має ходити на
 * сервер, щоб намалювати позначку в таблиці. Якщо міняти — то в обох місцях і
 * на сторінці /privacy.
 */
export const RETENTION_MONTHS = 12

/** Мінімальний строк, нижче якого сервер не опускається (захист від «0»). */
export const MIN_RETENTION_MONTHS = 6

/** Остання активність: пізніше з приєднання й останньої гри. */
export function lastActivity({ joinedAt, lastPlayed }) {
  const dates = [joinedAt, lastPlayed].filter(Boolean)
  if (dates.length === 0) return null
  return dates.reduce((latest, value) => (value > latest ? value : latest))
}

/**
 * Межа, раніше за яку активність уже «за строком». Календарні місяці, а не
 * 30 × 12 днів: так само рахує сервер (make_interval(months => …)).
 */
export function retentionCutoff(now = new Date(), months = RETENTION_MONTHS) {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  return cutoff
}

/** Чи дитина вже довше за строк без жодної активності. */
export function isPastRetention(student, now = new Date(), months = RETENTION_MONTHS) {
  const last = lastActivity(student)
  if (!last) return false
  return new Date(last) < retentionCutoff(now, months)
}

/**
 * Функцій ще немає на сервері: міграцію не застосовано. Модератор має почути
 * саме це, а не «щось пішло не так».
 */
export class RetentionUnavailableError extends Error {}

function rethrow(error) {
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new RetentionUnavailableError(error.message)
  }
  throw error
}

/** Учні без активності довше за строк — для перегляду перед видаленням. */
export async function listInactiveStudents(months = RETENTION_MONTHS) {
  const { data, error } = await supabase.rpc('inactive_students', { p_months: months })
  if (error) rethrow(error)
  return (data ?? []).map((row) => ({
    id: row.student_id,
    displayName: row.display_name ?? 'Учень',
    inGroup: Boolean(row.group_id),
    lastActivity: row.last_activity,
  }))
}

/** Видаляє всіх, хто за строком. Повертає, скільки учнів видалено. */
export async function purgeInactiveStudents(months = RETENTION_MONTHS) {
  const { data, error } = await supabase.rpc('purge_inactive_students', { p_months: months })
  if (error) rethrow(error)
  return data ?? 0
}

/** Модератор видаляє будь-якого учня, зокрема вже прибраного з групи. */
export async function moderatorDeleteStudent(studentId) {
  const { error } = await supabase.rpc('moderator_delete_student', { p_student_id: studentId })
  if (error) rethrow(error)
}
