import { supabase } from './supabaseClient'

/**
 * Фахівці групи й перенесення дитини
 * (supabase/migrations/20261015_team_avatars.sql).
 *
 * Як і деінде, сервер каже причину відмови токеном, а речення — тут. Поки
 * міграцію не застосовано, функцій немає — тоді TEAM_ERROR.UNAVAILABLE, і
 * сторінка просто не показує розділу.
 */
export const TEAM_ERROR = {
  NOT_OWNER: 'not_owner',
  NOT_ALLOWED: 'not_allowed',
  TEACHER_NOT_FOUND: 'teacher_not_found',
  ALREADY_OWNER: 'already_owner',
  INVALID_CODE: 'invalid_code',
  SAME_GROUP: 'same_group',
  NOT_A_STUDENT: 'not_a_student',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
}

export const TEAM_ERROR_TEXT = {
  [TEAM_ERROR.NOT_OWNER]: 'Це може лише той, хто створив групу.',
  [TEAM_ERROR.NOT_ALLOWED]: 'Переводити дитину може лише той, хто створив її групу.',
  [TEAM_ERROR.TEACHER_NOT_FOUND]:
    'Вчителя з такою поштою не знайдено. Колега має спершу зареєструватися на сайті поштою.',
  [TEAM_ERROR.ALREADY_OWNER]: 'Це ваша власна пошта — ви й так ведете цю групу.',
  [TEAM_ERROR.INVALID_CODE]: 'Групи з таким кодом немає. Перевірте літери.',
  [TEAM_ERROR.SAME_GROUP]: 'Дитина вже в цій групі.',
  [TEAM_ERROR.NOT_A_STUDENT]: 'Переводити можна лише учнів.',
  [TEAM_ERROR.UNAVAILABLE]:
    'Ця дія ще не ввімкнена на сервері: треба застосувати міграцію 20261015_team_avatars.sql.',
  [TEAM_ERROR.UNKNOWN]: 'Не вдалося. Спробуйте ще раз за хвилину.',
}

const SERVER_REASONS = Object.values(TEAM_ERROR).filter(
  (reason) => reason !== TEAM_ERROR.UNKNOWN && reason !== TEAM_ERROR.UNAVAILABLE,
)

export class TeamError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'TeamError'
    this.reason = reason
    this.cause = cause
  }
}

function toTeamError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new TeamError(TEAM_ERROR.UNAVAILABLE, error)
  }
  const parts = [error?.details, error?.message, error?.hint].filter(
    (part) => typeof part === 'string',
  )
  const reason =
    SERVER_REASONS.find((token) => parts.some((part) => part.includes(token))) ??
    TEAM_ERROR.UNKNOWN
  return new TeamError(reason, error)
}

/** Власник і фахівці групи: спершу власник, далі за датою додавання. */
export async function listGroupTeam(groupId) {
  const { data, error } = await supabase.rpc('list_group_team', { p_group_id: groupId })
  if (error) throw toTeamError(error)
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    isOwner: Boolean(row.is_owner),
    addedAt: row.added_at,
  }))
}

export async function addGroupSpecialist(groupId, email) {
  const { error } = await supabase.rpc('add_group_specialist', {
    p_group_id: groupId,
    p_email: email.trim(),
  })
  if (error) throw toTeamError(error)
}

export async function removeGroupSpecialist(groupId, specialistId) {
  const { error } = await supabase.rpc('remove_group_specialist', {
    p_group_id: groupId,
    p_specialist_id: specialistId,
  })
  if (error) throw toTeamError(error)
}

/** Повертає id нової групи. */
export async function moveStudent(studentId, targetCode) {
  const { data, error } = await supabase.rpc('teacher_move_student', {
    p_student_id: studentId,
    p_target_code: targetCode.trim().toUpperCase(),
  })
  if (error) throw toTeamError(error)
  return data
}
