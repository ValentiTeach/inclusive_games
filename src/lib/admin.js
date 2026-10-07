import { supabase, isCloudConfigured } from './supabaseClient'
import { ParentError, parentErrorReason } from './parents'

export async function listAllUsers() {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return data
}

/**
 * Сервер повертає причину відмови токеном, а не реченням: «не можна змінити
 * власну роль» — це не збій, який варто ховати за «спробуй ще раз».
 */
export const ROLE_ERROR = {
  OWN_ROLE: 'cannot_change_own_role',
}

export class RoleError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'RoleError'
    this.reason = reason
    this.cause = cause
  }
}

export async function setUserRole(userId, role) {
  const { error } = await supabase.rpc('admin_set_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (!error) return

  const text = [error.details, error.message, error.hint].filter((part) => typeof part === 'string')
  if (text.some((part) => part.includes(ROLE_ERROR.OWN_ROLE))) {
    throw new RoleError(ROLE_ERROR.OWN_ROLE, error)
  }
  throw error
}

/**
 * Заявки батьків (supabase/migrations/20261006_parent_approval.sql).
 *
 * Міграція застосовується окремо від викладки коду. Поки її немає, PostgREST
 * відповідає, що функції не знайдено, — і модератор має почути саме це, а не
 * «щось пішло не так»: нічого не зламано, дія ще не ввімкнена.
 */
export class ParentApprovalUnavailableError extends Error {}

function rethrow(error) {
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new ParentApprovalUnavailableError(error.message)
  }
  throw new ParentError(parentErrorReason(error), error)
}

/** Заявки, що чекають рішення, найстаріші спершу. */
export async function listParentRequests() {
  const { data, error } = await supabase.rpc('admin_list_parent_requests')
  if (error) rethrow(error)
  return (data ?? []).map((row) => ({
    id: row.request_id,
    createdAt: row.created_at,
    parentId: row.parent_id,
    parentEmail: row.parent_email,
    parentName: row.parent_name,
    parentRole: row.parent_role,
    parentHasGroups: Boolean(row.parent_has_groups),
    studentId: row.student_id,
    studentName: row.student_name ?? 'Учень',
    groupName: row.group_name,
    teacherName: row.teacher_name,
    invitedByName: row.invited_by_name,
  }))
}

export async function decideParentRequest(requestId, approve) {
  const { error } = await supabase.rpc('admin_decide_parent_request', {
    p_request_id: requestId,
    p_approve: approve,
  })
  if (error) rethrow(error)
}

/**
 * Скільки заявок чекає — для лічильника біля пункту «Адмінка». Іде не через
 * RPC, а простим підрахунком по таблиці: модератор читає її за власною
 * політикою, а головка запиту не тягне жодного рядка. Без міграції таблиці
 * немає — тоді просто нуль: лічильник не має ламати шапку.
 */
export async function countPendingParentRequests() {
  if (!isCloudConfigured) return 0

  const { count, error } = await supabase
    .from('parent_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) return 0
  return count ?? 0
}
