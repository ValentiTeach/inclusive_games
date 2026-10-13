import { supabase } from './supabaseClient'

/**
 * Власний акаунт дорослого: пошта, сеанси, передача груп і видалення.
 *
 * Серверний бік — supabase/migrations/20261013_logs_limits_account.sql. Як і
 * деінде, сервер каже причину відмови токеном, а речення складається тут.
 */
export const ACCOUNT_ERROR = {
  HAS_GROUPS: 'has_groups',
  STUDENT_ACCOUNT: 'student_account',
  MODERATOR_ACCOUNT: 'moderator_account',
  TEACHER_NOT_FOUND: 'teacher_not_found',
  CANNOT_TRANSFER_TO_SELF: 'cannot_transfer_to_self',
  NO_GROUPS: 'no_groups',
  NOT_SIGNED_IN: 'not_signed_in',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
}

export const ACCOUNT_ERROR_TEXT = {
  [ACCOUNT_ERROR.HAS_GROUPS]:
    'У вас ще є групи. Передайте їх колезі або позначте, що їх треба видалити разом з акаунтом.',
  [ACCOUNT_ERROR.STUDENT_ACCOUNT]:
    'Дані учня видаляє вчитель групи або модератор — за згодою батьків.',
  [ACCOUNT_ERROR.MODERATOR_ACCOUNT]:
    'Модератор не може видалити себе сам: платформа лишилася б без модератора. Попросіть іншого модератора спершу змінити вашу роль.',
  [ACCOUNT_ERROR.TEACHER_NOT_FOUND]:
    'Вчителя з такою поштою не знайдено. Колега має спершу зареєструватися на сайті поштою.',
  [ACCOUNT_ERROR.CANNOT_TRANSFER_TO_SELF]: 'Це ваша власна пошта — вкажіть пошту колеги.',
  [ACCOUNT_ERROR.NO_GROUPS]: 'У вас немає груп, які можна передати.',
  [ACCOUNT_ERROR.NOT_SIGNED_IN]: 'Сеанс завершився. Увійдіть знову.',
  [ACCOUNT_ERROR.UNAVAILABLE]:
    'Ця дія ще не ввімкнена на сервері. Напишіть модератору платформи — він видалить акаунт вручну.',
  [ACCOUNT_ERROR.UNKNOWN]: 'Не вдалося. Спробуйте ще раз за хвилину.',
}

const SERVER_REASONS = Object.values(ACCOUNT_ERROR).filter(
  (reason) => reason !== ACCOUNT_ERROR.UNKNOWN && reason !== ACCOUNT_ERROR.UNAVAILABLE,
)

export class AccountError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'AccountError'
    this.reason = reason
    this.cause = cause
  }
}

function toAccountError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new AccountError(ACCOUNT_ERROR.UNAVAILABLE, error)
  }
  const parts = [error?.details, error?.message, error?.hint].filter(
    (part) => typeof part === 'string',
  )
  const reason =
    SERVER_REASONS.find((token) => parts.some((part) => part.includes(token))) ??
    ACCOUNT_ERROR.UNKNOWN
  return new AccountError(reason, error)
}

/** Групи, якими людина керує сама, — не всі, які вона бачить. */
export async function fetchOwnGroups(userId) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Повертає, скільки груп передано. */
export async function transferMyGroups(email) {
  const { data, error } = await supabase.rpc('transfer_my_groups', { p_email: email.trim() })
  if (error) throw toAccountError(error)
  return data ?? 0
}

/**
 * Видаляє акаунт на сервері. Сеанс у браузері лишається — його прибирає
 * forgetSession, і саме в такому порядку: сторінка спершу має показати
 * «акаунт видалено», а вже потім втратити користувача. Інакше вихід
 * перекинув би на сторінку входу без жодного пояснення.
 */
export async function deleteMyAccount({ deleteGroups = false } = {}) {
  const { error } = await supabase.rpc('delete_my_account', { p_delete_groups: deleteGroups })
  if (error) throw toAccountError(error)
}

/**
 * Прибирає сеанс видаленого акаунта в цьому браузері. Локально — бо
 * глобальний вихід уже нема для кого робити: користувача не існує.
 */
export async function forgetSession() {
  await supabase.auth.signOut({ scope: 'local' })
}

/**
 * Зміна пошти. Supabase надсилає лист підтвердження на нову адресу (а з
 * увімкненим «Secure email change» — і на стару); пошта змінюється лише після
 * переходу за посиланням.
 */
export async function changeEmail(email) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${window.location.origin}/account` },
  )
  if (error) throw error
}

/**
 * Вийти на всіх пристроях: відкликає всі сеанси цього акаунта, зокрема на
 * загубленому телефоні. Чинний токен там проживе до кінця свого строку
 * (до години), але оновити його вже не вийде.
 */
export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw error
}
