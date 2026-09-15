import { GAMES } from '../data/games'
import { aggregateMetric, METRIC_AGGREGATION, orderMetricKeys } from '../games/engine/metrics'

const GAME_INFO = Object.fromEntries(GAMES.map((game) => [game.id, game]))

/**
 * Зріз групи за іграми.
 *
 * Дев'ятнадцять ігор пишуть у базу докладні показники — точність, час реакції,
 * обсяг пам'яті — і досі жоден із них не мав виходу в інтерфейс: учитель бачив
 * лише «скільки спроб» і середній бал по всіх іграх разом. Середнє по всіх
 * іграх відповідає на питання «як воно загалом», але не на те, заради якого
 * учитель сюди заходить: де саме дитина просідає.
 *
 * Тут спроби групуються за грою, а всередині гри — за учнем, і кожен показник
 * зводиться за своїм правилом (див. METRIC_AGGREGATION).
 */
function averageScore(attempts) {
  if (attempts.length === 0) return null
  return Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
}

function lastPlayed(attempts) {
  return attempts.reduce(
    (latest, attempt) => (!latest || attempt.played_at > latest ? attempt.played_at : latest),
    null,
  )
}

/** Показники, які взагалі зустрічались у цих спробах, у сталому порядку. */
export function metricKeysOf(attempts) {
  const keys = new Set()
  for (const attempt of attempts) {
    for (const [key, value] of Object.entries(attempt.metrics ?? {})) {
      if (Number.isFinite(value) && key in METRIC_AGGREGATION) keys.add(key)
    }
  }
  return orderMetricKeys([...keys])
}

export function aggregateAll(attempts) {
  const metricsList = attempts.map((attempt) => attempt.metrics ?? {})
  const result = {}
  for (const key of metricKeysOf(attempts)) {
    const value = aggregateMetric(key, metricsList)
    if (value !== undefined) result[key] = value
  }
  return result
}

/**
 * @param results спроби з бази: user_id, game_id, score, metrics, played_at
 * @param students учні групи: id, displayName
 */
export function breakdownByGame(results, students) {
  const byName = new Map(students.map((student) => [student.id, student.displayName]))
  const games = new Map()

  for (const result of results) {
    // Спроба учня, якого вже видалили з групи, до зрізу не входить: вона
    // роздувала б «скільки дітей грали» іменем, якого в списку немає.
    if (!byName.has(result.user_id)) continue
    if (!games.has(result.game_id)) games.set(result.game_id, [])
    games.get(result.game_id).push(result)
  }

  const rows = []
  for (const [gameId, attempts] of games) {
    const info = GAME_INFO[gameId]
    const byStudent = new Map()

    for (const attempt of attempts) {
      if (!byStudent.has(attempt.user_id)) byStudent.set(attempt.user_id, [])
      byStudent.get(attempt.user_id).push(attempt)
    }

    rows.push({
      gameId,
      // Гра могла зникнути з каталогу, а спроби лишились: показуємо id, щоб
      // рядок не став безіменним.
      title: info?.title ?? gameId,
      category: info?.category ?? null,
      players: byStudent.size,
      attempts: attempts.length,
      avgScore: averageScore(attempts),
      lastPlayed: lastPlayed(attempts),
      metrics: aggregateAll(attempts),
      metricKeys: metricKeysOf(attempts),
      students: [...byStudent.entries()]
        .map(([userId, studentAttempts]) => ({
          id: userId,
          displayName: byName.get(userId),
          attempts: studentAttempts.length,
          avgScore: averageScore(studentAttempts),
          lastPlayed: lastPlayed(studentAttempts),
          metrics: aggregateAll(studentAttempts),
        }))
        // Найслабший зверху: учитель шукає, кому потрібна допомога, а не хто
        // й так молодець.
        .sort((a, b) => a.avgScore - b.avgScore),
    })
  }

  // Ігри, у які грали найбільше, — угорі: вони показові для класу, а гра з
  // однією спробою нічого про групу не каже.
  return rows.sort((a, b) => b.attempts - a.attempts || a.title.localeCompare(b.title, 'uk'))
}

/**
 * Учні групи, які ще не грали в цю гру. Порожня клітинка — теж відповідь:
 * «дитина цього не робила» і «дитина зробила погано» — різні речі, і плутати
 * їх не можна.
 */
export function studentsWithoutAttempts(row, students) {
  const played = new Set(row.students.map((student) => student.id))
  return students.filter((student) => !played.has(student.id))
}
