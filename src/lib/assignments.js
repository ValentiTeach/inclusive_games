import { supabase } from './supabaseClient'
import { localDay } from './day'

/**
 * Завдання від учителя.
 *
 * Прогрес свідомо не зберігається в базі, а рахується з наявних спроб. Друге
 * джерело правди про те саме («скільки разів дитина зіграла») довелося б
 * оновлювати при кожному результаті й стежити, щоб воно не розійшлося з
 * results, — а розійшлося б воно обов'язково.
 */

/**
 * Помилка «таблиці ще немає» — не привід ламати сторінку.
 *
 * Міграція застосовується окремо від викладки коду, тож між ними є проміжок, у
 * якому фронт уже вміє завдання, а база ще ні. PostgREST відповідає на це
 * кодами PGRST205 («Could not find the table») або 42P01, і це єдиний випадок,
 * коли мовчазне «завдань немає» чесніше за повідомлення про помилку: учитель
 * нічого не зламав і нічого не може з цим удіяти.
 */
export function isMissingTable(error) {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01'
}

export async function listAssignments(groupId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, group_id, game_id, level_id, target_attempts, due_on, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (isMissingTable(error)) return null
  if (error) throw error
  return data
}

export async function createAssignment({ groupId, gameId, levelId, targetAttempts, dueOn }) {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      group_id: groupId,
      game_id: gameId,
      // Порожній рядок із <select> — це «будь-який рівень», а не рівень із
      // назвою «». У базі має лежати null.
      level_id: levelId || null,
      target_attempts: targetAttempts,
      due_on: dueOn || null,
    })
    .select('id, group_id, game_id, level_id, target_attempts, due_on, created_at')
    .single()

  if (error) throw error
  return data
}

export async function deleteAssignment(id) {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
}

/**
 * Чи зараховується ця спроба в це завдання.
 *
 * Дві умови, і обидві важливі:
 *
 * - Спроба має бути *після* видачі завдання. Інакше клас, який грав у Шульте
 *   минулого тижня, виконав би завдання ще до того, як його почув.
 * - Рівень збігається, якщо він заданий. «Зіграйте 5×5» і «зіграйте» — різні
 *   завдання, і зарахувати 3×3 замість 5×5 означало б порахувати не те.
 */
export function countsToward(assignment, attempt) {
  if (attempt.game_id !== assignment.game_id) return false
  if (assignment.level_id && attempt.level_id !== assignment.level_id) return false
  return attempt.played_at >= assignment.created_at
}

/**
 * Скільки учнів виконали завдання і хто саме ще ні.
 *
 * @param students учні групи: { id, displayName }
 * @param results спроби групи: { user_id, game_id, level_id, played_at }
 */
export function assignmentProgress(assignment, students, results) {
  const byStudent = new Map(students.map((student) => [student.id, 0]))

  for (const attempt of results) {
    if (!byStudent.has(attempt.user_id)) continue
    if (!countsToward(assignment, attempt)) continue
    byStudent.set(attempt.user_id, byStudent.get(attempt.user_id) + 1)
  }

  const done = []
  const pending = []
  for (const student of students) {
    const played = byStudent.get(student.id) ?? 0
    ;(played >= assignment.target_attempts ? done : pending).push({ ...student, played })
  }

  return {
    done,
    pending,
    total: students.length,
    // Порожня група — це не «всі впорались»: ділити на нуль тут не можна ані
    // арифметично, ані за змістом.
    percent: students.length ? Math.round((done.length / students.length) * 100) : 0,
  }
}

/** Завдання, які дитина ще не виконала. Саме їх вона має бачити в каталозі. */
export function openAssignments(assignments, myResults, studentId) {
  return assignments.filter((assignment) => {
    const played = myResults.filter(
      (attempt) => attempt.user_id === studentId && countsToward(assignment, attempt),
    ).length
    return played < assignment.target_attempts
  })
}

/** Прострочене завдання лишається видимим, але позначається окремо. */
export function isOverdue(assignment, today = new Date()) {
  if (!assignment.due_on) return false
  return assignment.due_on < localDay(today)
}
