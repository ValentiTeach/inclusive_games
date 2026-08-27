import { supabase } from './supabaseClient'

export async function listAllUsers() {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return data
}

export async function setUserRole(userId, role) {
  const { error } = await supabase.rpc('admin_set_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw error
}
