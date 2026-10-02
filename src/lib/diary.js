import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'
import { readSealed, seal } from './vault'

/**
 * Щоденник фахівця: швидкі позначки після заняття.
 *
 * Увесь запис — рівень допомоги, поведінка, нотатка — шифрується одним шматком
 * у браузері (lib/vault). Навіть одне слово «тривожний» без тексту — це вже
 * відомість про дитину, тож відкритих полів тут немає зовсім.
 */

export const HELP_LEVELS = [
  { id: 'none', label: 'Сам(а)' },
  { id: 'prompt', label: 'Словесна підказка' },
  { id: 'model', label: 'Показ' },
  { id: 'joint', label: 'Разом із дорослим' },
]

export const BEHAVIORS = [
  { id: 'focused', label: 'Зосереджений' },
  { id: 'distracted', label: 'Відволікався' },
  { id: 'tired', label: 'Втомився' },
  { id: 'anxious', label: 'Тривожний' },
]

export const HELP_LABELS = Object.fromEntries(HELP_LEVELS.map(({ id, label }) => [id, label]))
export const BEHAVIOR_LABELS = Object.fromEntries(BEHAVIORS.map(({ id, label }) => [id, label]))

/** Контекст шифру: запис щоденника однієї дитини не відкриється як запис іншої. */
export function diaryContext(studentId) {
  return `diary:${studentId}`
}

export async function listDiary(studentId) {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('id, student_id, run_id, created_at, sealed')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (isMissingTable(error)) return null
  if (error) throw error
  return data
}

/** Розшифровані записи; null на місці запису — не вдалося відкрити. */
export async function openDiary(rows) {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      entry: await readSealed(row.sealed, diaryContext(row.student_id)),
    })),
  )
}

export function normalizeEntry({ help, behavior, note }) {
  return {
    help: HELP_LABELS[help] ? help : null,
    behavior: (behavior ?? []).filter((id) => BEHAVIOR_LABELS[id]),
    note: String(note ?? '').slice(0, 4000),
  }
}

export async function addDiaryEntry({ studentId, runId = null, entry, publicKey }) {
  const sealed = await seal(publicKey, normalizeEntry(entry), diaryContext(studentId))
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({ student_id: studentId, run_id: runId, sealed })
    .select('id, student_id, run_id, created_at, sealed')
    .single()
  if (error) throw error
  return data
}

export async function deleteDiaryEntry(id) {
  const { error } = await supabase.from('diary_entries').delete().eq('id', id)
  if (error) throw error
}

/* Настрій дитини в занятті — три смайлики, шифрується ключем учителя групи. */

export const MOODS = [
  { id: 'good', label: 'Добре' },
  { id: 'okay', label: 'Так собі' },
  { id: 'sad', label: 'Сумно' },
]

export const MOOD_LABELS = Object.fromEntries(MOODS.map(({ id, label }) => [id, label]))

export function moodContext(runId, when) {
  return `mood:${runId}:${when}`
}
