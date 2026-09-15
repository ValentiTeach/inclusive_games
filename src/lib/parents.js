import { supabase } from './supabaseClient'

/*
 * Машинні коди відмов сервера. Так само, як у groups.js: сервер пише токен і в
 * MESSAGE, і в DETAIL, бо різні версії PostgREST розкладають помилку по різних
 * полях, а речення для людини складається тут.
 */
export const PARENT_ERROR = {
  NOT_SIGNED_IN: 'not_signed_in',
  ANONYMOUS_NOT_ALLOWED: 'anonymous_not_allowed',
  INVALID_CODE: 'invalid_code',
  CODE_ALREADY_USED: 'code_already_used',
  CANNOT_WATCH_SELF: 'cannot_watch_self',
  STUDENT_NOT_FOUND: 'student_not_found',
  NOT_ALLOWED: 'not_allowed',
  UNKNOWN: 'unknown',
}

const SERVER_REASONS = Object.values(PARENT_ERROR).filter(
  (reason) => reason !== PARENT_ERROR.UNKNOWN,
)

export const PARENT_ERROR_TEXT = {
  [PARENT_ERROR.NOT_SIGNED_IN]: 'Спочатку увійдіть у свій акаунт.',
  [PARENT_ERROR.ANONYMOUS_NOT_ALLOWED]:
    'Для доступу до результатів дитини потрібен акаунт із поштою, а не гостьовий вхід.',
  [PARENT_ERROR.INVALID_CODE]: 'Такого коду немає. Перевірте, чи всі літери на місці.',
  [PARENT_ERROR.CODE_ALREADY_USED]:
    'Цей код уже використали. Попросіть учителя виписати новий.',
  [PARENT_ERROR.CANNOT_WATCH_SELF]: 'Це код вашого власного профілю.',
  [PARENT_ERROR.STUDENT_NOT_FOUND]: 'Цієї дитини вже немає в групі.',
  [PARENT_ERROR.NOT_ALLOWED]: 'Код для батьків виписує вчитель цієї групи.',
  [PARENT_ERROR.UNKNOWN]: 'Не вдалося. Спробуйте ще раз за хвилину.',
}

export class ParentError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'ParentError'
    this.reason = reason
    this.cause = cause
  }
}

export function parentErrorReason(error) {
  const parts = [error?.details, error?.message, error?.hint].filter(
    (part) => typeof part === 'string',
  )
  return (
    SERVER_REASONS.find((reason) => parts.some((part) => part.includes(reason))) ??
    PARENT_ERROR.UNKNOWN
  )
}

/** Вчитель виписує код на конкретну дитину. */
export async function createParentInvite(studentId) {
  const { data, error } = await supabase.rpc('create_parent_invite', {
    p_student_id: studentId,
  })
  if (error) throw new ParentError(parentErrorReason(error), error)
  return data
}

/** Дорослий уводить код і дістає доступ до однієї дитини. */
export async function redeemParentInvite(code) {
  const { data, error } = await supabase.rpc('redeem_parent_invite', { p_code: code })
  if (error) throw new ParentError(parentErrorReason(error), error)
  return data
}

/*
 * Діти, за якими дивиться цей дорослий. RLS уже обмежує вибірку його власними
 * зв'язками, але фільтр за parent_id лишається: покладатися на політику як на
 * єдиний бар'єр означало б, що одна помилка в ній відкриває чужих дітей.
 */
export async function fetchMyChildren(parentId) {
  const { data, error } = await supabase
    .from('parent_links')
    .select('student_id, created_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) throw new ParentError(parentErrorReason(error), error)

  const ids = (data ?? []).map((link) => link.student_id)
  if (ids.length === 0) return []

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, group_id')
    .in('id', ids)

  if (profileError) throw new ParentError(parentErrorReason(profileError), profileError)
  return profiles ?? []
}

/** Спроби однієї дитини — те саме, що бачить вона сама у «Моєму прогресі». */
export async function fetchChildResults(studentId) {
  const { data, error } = await supabase
    .from('results')
    .select('game_id, score, entries, metrics, level_id, played_at')
    .eq('user_id', studentId)
    .order('played_at', { ascending: false })

  if (error) throw new ParentError(parentErrorReason(error), error)
  return data ?? []
}
