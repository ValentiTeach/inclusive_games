import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'

/**
 * Згода на листи (20261015_notifications_vitals.sql). Без рядка — нічого не
 * ввімкнено: листів без згоди людини немає.
 *
 * Повертає null, якщо таблиці ще немає (міграцію не застосовано) — тоді
 * сторінка акаунта просто не показує розділу.
 */
export const NO_NOTIFICATIONS = { weeklyDigest: false, parentRequests: false }

export async function getNotificationSettings(userId) {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('weekly_digest, parent_requests')
    .eq('user_id', userId)
    .maybeSingle()
  if (isMissingTable(error)) return null
  if (error) throw error
  return data
    ? { weeklyDigest: data.weekly_digest, parentRequests: data.parent_requests }
    : NO_NOTIFICATIONS
}

export async function saveNotificationSettings(userId, settings) {
  const { error } = await supabase.from('notification_settings').upsert({
    user_id: userId,
    weekly_digest: Boolean(settings.weeklyDigest),
    parent_requests: Boolean(settings.parentRequests),
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
