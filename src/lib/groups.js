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
