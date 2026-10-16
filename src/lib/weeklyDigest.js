import { goalProgress } from './goals'

/**
 * Підсумок тижня для групи: що вчителю варто помітити, не відкриваючи
 * таблиць.
 *
 * - **Не грали 7 днів** — разом із тими, хто ще жодного разу не грав.
 * - **Помітно просів / виріс бал** — у тій самій грі, а не «загалом»: бал
 *   Шульте і бал Струпа не порівнюються між собою. Свіжий тиждень проти
 *   чотирьох попередніх, і лише коли в кожному вікні є хоч дві спроби — одна
 *   невдала гра ще не падіння.
 * - **Досягли цілі ІПР** — за тим самим правилом, що й картка дитини
 *   (goalProgress: медіана трьох останніх спроб, а не рекорд).
 *
 * Чиста функція: дані вже є на сторінці групи, і підсумок рахується з них.
 */

const DAY = 24 * 60 * 60 * 1000
export const WEEK_DAYS = 7
const BASELINE_DAYS = 28
export const NOTABLE_CHANGE = 15
const MIN_ATTEMPTS = 2

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weeklyDigest({ students, results, goals = [], now = new Date() }) {
  const weekStart = now.getTime() - WEEK_DAYS * DAY
  const baselineStart = weekStart - BASELINE_DAYS * DAY

  const byStudent = new Map(students.map((student) => [student.id, []]))
  for (const result of results) byStudent.get(result.user_id)?.push(result)

  const thisWeek = results.filter((result) => new Date(result.played_at).getTime() >= weekStart)
  const activeIds = new Set(thisWeek.map((result) => result.user_id))

  const inactive = students
    .filter((student) => !activeIds.has(student.id))
    .map((student) => {
      const own = byStudent.get(student.id) ?? []
      const last = own.reduce(
        (latest, result) => (!latest || result.played_at > latest ? result.played_at : latest),
        null,
      )
      return { student, lastPlayed: last }
    })
    // Найдовше відсутні — першими; ті, хто не грав ніколи, — на самому верху.
    .sort((a, b) => (a.lastPlayed ?? '').localeCompare(b.lastPlayed ?? ''))

  const changes = []
  for (const student of students) {
    const own = byStudent.get(student.id) ?? []
    const games = new Map()
    for (const result of own) {
      const time = new Date(result.played_at).getTime()
      if (time < baselineStart) continue
      const entry = games.get(result.game_id) ?? { recent: [], before: [] }
      ;(time >= weekStart ? entry.recent : entry.before).push(result.score)
      games.set(result.game_id, entry)
    }

    let biggest = null
    for (const [gameId, { recent, before }] of games) {
      if (recent.length < MIN_ATTEMPTS || before.length < MIN_ATTEMPTS) continue
      const delta = Math.round(mean(recent) - mean(before))
      if (Math.abs(delta) < NOTABLE_CHANGE) continue
      if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
        biggest = { student, gameId, delta, before: Math.round(mean(before)), now: Math.round(mean(recent)) }
      }
    }
    if (biggest) changes.push(biggest)
  }

  const goalsReached = (goals ?? [])
    .map((goal) => {
      const student = students.find((entry) => entry.id === goal.student_id)
      if (!student) return null
      const progress = goalProgress(goal, byStudent.get(student.id) ?? [], now)
      return progress.achieved ? { student, goal, progress } : null
    })
    .filter(Boolean)

  return {
    attempts: thisWeek.length,
    activeCount: activeIds.size,
    inactive,
    drops: changes.filter((change) => change.delta < 0).sort((a, b) => a.delta - b.delta),
    rises: changes.filter((change) => change.delta > 0).sort((a, b) => b.delta - a.delta),
    goalsReached,
  }
}
