import { supabase } from './supabaseClient'

/** Міграцію 20261015 ще не застосовано — тваринку нема куди записати. */
export class AvatarUnavailableError extends Error {}

/**
 * Дитина обирає собі тваринку (profiles.avatar). Через функцію, а не update:
 * змінюється рівно одна колонка рівно свого профілю.
 */
export async function setMyAvatar(key) {
  const { error } = await supabase.rpc('set_my_avatar', { p_avatar: key })
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new AvatarUnavailableError(error.message)
  }
  if (error) throw error
}
