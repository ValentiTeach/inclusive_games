import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'
import { localDay } from './day'

/**
 * Відмітка вчителя «згоду батьків отримано» (таблиця parental_consents).
 *
 * Сама згода — підписаний папір (зразок на /privacy/consent), і зберігається
 * він у школі. Платформа пам'ятає лише дату, щоб учитель бачив у таблиці
 * групи, на кого згоди ще немає, а не тримав це в голові.
 *
 * Поки міграцію не застосовано, список повертає null — і колонка просто не
 * з'являється, як і завдання до своєї міграції.
 */

/** { [studentId]: 'YYYY-MM-DD' } або null, якщо таблиці ще немає. */
export async function listConsents(studentIds) {
  if (studentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('parental_consents')
    .select('student_id, given_on')
    .in('student_id', studentIds)

  if (isMissingTable(error)) return null
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.student_id, row.given_on]))
}

/** Відмічає згоду. Дата — сьогодні за місцевим часом, як на папері. */
export async function recordConsent(studentId, givenOn = localDay()) {
  const { error } = await supabase
    .from('parental_consents')
    .upsert({ student_id: studentId, given_on: givenOn }, { onConflict: 'student_id' })
  if (error) throw error
  return givenOn
}

/** Знімає відмітку: батьки відкликали згоду або її поставили не тій дитині. */
export async function clearConsent(studentId) {
  const { error } = await supabase.from('parental_consents').delete().eq('student_id', studentId)
  if (error) throw error
}
