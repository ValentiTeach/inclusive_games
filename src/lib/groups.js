import { supabase } from './supabaseClient'
import { clearAllResults } from '../games/engine/storage'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'

function generateCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function createGroup(name) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Потрібно увійти, щоб створити групу.')

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('groups')
      .insert({ name, join_code: generateCode(), teacher_id: session.user.id })
      .select()
      .single()

    if (!error) return data
    if (error.code !== UNIQUE_VIOLATION) throw error
  }

  throw new Error('Не вдалося згенерувати унікальний код. Спробуй ще раз.')
}

export async function getMyGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, join_code, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getGroupDetails(groupId) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, join_code')
    .eq('id', groupId)
    .single()

  if (groupError) throw groupError

  const { data: students, error: studentsError } = await supabase
    .from('profiles')
    .select('id, display_name, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (studentsError) throw studentsError

  const studentIds = students.map((student) => student.id)
  let results = []

  if (studentIds.length > 0) {
    const { data, error: resultsError } = await supabase
      .from('results')
      .select('user_id, game_id, level_id, score, played_at')
      .in('user_id', studentIds)

    if (resultsError) throw resultsError
    results = data
  }

  const students_ = students.map((student) => {
    const studentResults = results.filter((result) => result.user_id === student.id)
    const attempts = studentResults.length
    const avgScore =
      attempts > 0
        ? Math.round(studentResults.reduce((sum, result) => sum + result.score, 0) / attempts)
        : null
    const lastPlayed =
      attempts > 0
        ? studentResults.reduce(
            (latest, result) => (result.played_at > latest ? result.played_at : latest),
            studentResults[0].played_at,
          )
        : null

    return {
      id: student.id,
      displayName: student.display_name ?? 'Учень',
      joinedAt: student.created_at,
      attempts,
      avgScore,
      lastPlayed,
    }
  })

  // Raw attempts ride along with the aggregates: the table shows averages, but
  // the CSV export needs every attempt, and re-querying for it would mean a
  // second round trip for data already in hand.
  return { group, students: students_, results }
}

/**
 * Both of these go through RPCs rather than a plain update: "the teacher of
 * this student's group" isn't something the profiles RLS policies can express,
 * so the check lives in a SECURITY DEFINER function on the server side.
 */
export async function renameStudent(studentId, displayName) {
  const { error } = await supabase.rpc('teacher_rename_student', {
    p_student_id: studentId,
    p_display_name: displayName,
  })
  if (error) throw error
}

export async function removeStudentFromGroup(studentId) {
  const { error } = await supabase.rpc('teacher_remove_student', {
    p_student_id: studentId,
  })
  if (error) throw error
}

/**
 * Why a join can fail, as a machine-readable token. The server raises exactly
 * these strings (supabase/migrations/20260909_shared_computer_identity.sql);
 * the Ukrainian wording lives in the UI, so both sides only have to agree on
 * the tokens.
 */
export const JOIN_ERROR = {
  NOT_SIGNED_IN: 'not_signed_in',
  EMPTY_NAME: 'empty_name',
  NAME_TOO_LONG: 'name_too_long',
  INVALID_CODE: 'invalid_code',
  NOT_A_STUDENT: 'not_a_student',
  SESSION_BELONGS_TO_OTHER: 'session_belongs_to_other',
  UNKNOWN: 'unknown',
}

const SERVER_REASONS = Object.values(JOIN_ERROR).filter(
  (reason) => reason !== JOIN_ERROR.UNKNOWN,
)

export class JoinError extends Error {
  constructor(reason, cause) {
    super(reason)
    this.name = 'JoinError'
    this.reason = reason
    this.cause = cause
  }
}

/**
 * PostgREST spreads one Postgres error across message/details/hint, and which
 * field carries what has changed between its versions. The server writes the
 * token into both MESSAGE and DETAIL, and this reads all three, so no single
 * field is load-bearing.
 */
export function joinErrorReason(error) {
  const parts = [error?.details, error?.message, error?.hint].filter(
    (part) => typeof part === 'string',
  )
  return (
    SERVER_REASONS.find((reason) => parts.some((part) => part.includes(reason))) ??
    JOIN_ERROR.UNKNOWN
  )
}

/**
 * The same normalisation the server applies before comparing names, so the
 * page never offers "continue as ..." for a name the server will then reject.
 */
export function normalizeStudentName(value) {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

export function isSameStudent(a, b) {
  const left = normalizeStudentName(a).toLocaleLowerCase('uk')
  return left !== '' && left === normalizeStudentName(b).toLocaleLowerCase('uk')
}

/**
 * Who this browser is signed in as, from the join page's point of view.
 * Returns null when there is no session at all.
 */
export async function getSessionIdentity() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { user } = session
  const { data } = await supabase
    .from('profiles')
    .select('display_name, role, group_id')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    isAnonymous: Boolean(user.is_anonymous),
    email: user.email ?? null,
    displayName: data?.display_name ?? null,
    role: data?.role ?? null,
    groupId: data?.group_id ?? null,
  }
}

/**
 * Hand the computer to the next child: end the previous child's session and
 * start a clean one, so the two get separate accounts and separate results.
 *
 * The local history is cleared *between* the sign-out and the sign-in, and the
 * order matters. Those keys are per-browser, and migrateLocalHistoryOnce fires
 * off onAuthStateChange with a flag keyed by user id — so a brand-new account
 * would otherwise upload the previous child's attempts to the cloud as its own.
 */
export async function startFreshStudentSession() {
  await supabase.auth.signOut()
  clearAllResults()
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

/**
 * Join a group by code.
 *
 * With `startFresh`, the caller has established that the person at the keyboard
 * is not whoever the current session belongs to (see startFreshStudentSession).
 * Without it, an existing session is reused — which is correct for a child
 * coming back to their own device, and is refused by the server otherwise.
 */
export async function joinGroup(code, displayName, { startFresh = false } = {}) {
  if (startFresh) {
    await startFreshStudentSession()
  } else {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      const { error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) throw new JoinError(JOIN_ERROR.UNKNOWN, anonError)
    }
  }

  const { error } = await supabase.rpc('join_group', {
    p_code: code.trim().toUpperCase(),
    p_display_name: normalizeStudentName(displayName),
  })

  if (error) throw new JoinError(joinErrorReason(error), error)
}
