import { supabase } from './supabaseClient'

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

export async function joinGroup(code, displayName) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const { error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError) throw anonError
  }

  const { error } = await supabase.rpc('join_group', {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName.trim(),
  })

  if (error) throw error
}
