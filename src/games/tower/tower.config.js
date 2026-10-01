import { pickRandom, randomInt, shuffle } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Вежа (Tower of London) — планування й саморегуляція.
 *
 * Три стрижні різної висоти: на перший влазить три кульки, на другий — дві,
 * на третій — одна. Треба переставити кульки, як на зразку, за найменшу
 * кількість ходів. Імпульсивна дитина починає перекладати одразу й робить
 * зайві ходи; та, що планує, спершу думає. Тому окремо міряється час до
 * першого ходу, а не лише результат.
 */
export const CAPACITY = [3, 2, 1]

export const BALLS = {
  red: { color: '#c0392b', shape: 'star', name: 'червона' },
  green: { color: '#2e8b57', shape: 'triangle', name: 'зелена' },
  blue: { color: '#2d6bd6', shape: 'square', name: 'синя' },
}

export const config = {
  ...gameInfo('tower'),
  instructions: [
    'Зверху — зразок. Знизу — твоя вежа з трьох стрижнів різної висоти.',
    'Натисни стрижень, щоб узяти верхню кульку, потім інший — щоб її покласти.',
    'Склади так, як на зразку, за вказану кількість ходів. Спершу подумай, потім ходи.',
  ],
  keyHint: { keys: '1–3', text: 'вибрати стрижень' },
  practice: {
    hint: 'Бери лише верхню кульку. На короткий стрижень влазить одна, на середній — дві. Склади, як на зразку.',
    level: (level) => ({ ...level, trialCount: 2, moves: [1, 2] }),
  },
  levels: [
    { id: 'easy', label: '2–3 ходи', trialCount: 5, moves: [2, 3] },
    { id: 'classic', label: '3–4 ходи', trialCount: 6, moves: [3, 4] },
    { id: 'hard', label: '4–5 ходів', trialCount: 6, moves: [4, 5] },
  ],
}

export function stateKey(pegs) {
  return pegs.map((peg) => peg.join(',')).join('|')
}

export function canMove(pegs, from, to) {
  return from !== to && pegs[from].length > 0 && pegs[to].length < CAPACITY[to]
}

export function move(pegs, from, to) {
  const next = pegs.map((peg) => [...peg])
  next[to].push(next[from].pop())
  return next
}

function neighbours(pegs) {
  const result = []
  for (let from = 0; from < 3; from++) {
    for (let to = 0; to < 3; to++) {
      if (canMove(pegs, from, to)) result.push(move(pegs, from, to))
    }
  }
  return result
}

/** Найменша кількість ходів від кожного стану до кожного — пошуком ушир. */
export function distancesFrom(start) {
  const distances = new Map([[stateKey(start), { pegs: start, distance: 0 }]])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()
    const { distance } = distances.get(stateKey(current))
    for (const next of neighbours(current)) {
      const key = stateKey(next)
      if (!distances.has(key)) {
        distances.set(key, { pegs: next, distance: distance + 1 })
        queue.push(next)
      }
    }
  }
  return distances
}

const ALL_STATES = [...distancesFrom([['red', 'green', 'blue'], [], []]).values()].map(
  (entry) => entry.pegs,
)

/**
 * Задача з рівно `minMoves` найменших ходів. Старт випадковий, ціль — один зі
 * станів на потрібній відстані: не «приблизно стільки», а точно, бо саме з
 * цим числом порівнюються зайві ходи дитини.
 */
export function generateProblem(minMoves) {
  for (const start of shuffle(ALL_STATES)) {
    const goals = [...distancesFrom(start).values()].filter((entry) => entry.distance === minMoves)
    if (goals.length) return { start, goal: pickRandom(goals).pegs, minMoves }
  }
  throw new Error(`Немає задачі на ${minMoves} ходів`)
}

export function generateTrial(level) {
  return generateProblem(randomInt(level.moves[0], level.moves[1]))
}

export function isSolved(pegs, goal) {
  return stateKey(pegs) === stateKey(goal)
}

/* Скільки ходів дати, перш ніж перейти до наступної задачі: дитина, що
   заплуталась, не має застрягнути на одній задачі назавжди. */
export function moveLimit(minMoves) {
  return minMoves * 2 + 2
}

/**
 * `problems` — по одному запису на задачу:
 * { solved, moves, minMoves, planningMs, ruleBreaks }.
 */
export function scoring(problems) {
  const perfect = problems.filter((p) => p.solved && p.moves === p.minMoves).length
  const solved = problems.filter((p) => p.solved).length
  const planning = problems.map((p) => p.planningMs).filter(Number.isFinite)
  const perProblem = problems.map((p) =>
    p.solved ? clampScore(100 - (p.moves - p.minMoves) * 15) : 0,
  )

  const metrics = defineMetrics({
    total: problems.length,
    correct: perfect,
    errors: problems.length - perfect,
    accuracy_pct: problems.length ? Math.round((perfect / problems.length) * 100) : undefined,
    moves: problems.reduce((sum, p) => sum + p.moves, 0),
    extra_moves: problems.reduce((sum, p) => sum + Math.max(0, p.moves - p.minMoves), 0),
    rule_breaks: problems.reduce((sum, p) => sum + p.ruleBreaks, 0),
    planning_ms: planning.length
      ? Math.round(planning.reduce((sum, value) => sum + value, 0) / planning.length)
      : undefined,
  })

  return {
    score: perProblem.length
      ? clampScore(perProblem.reduce((sum, value) => sum + value, 0) / perProblem.length)
      : 0,
    entries: [
      { label: 'Розвʼязано', value: `${solved} / ${problems.length}` },
      { label: 'За найменшу кількість ходів', value: `${perfect} / ${problems.length}` },
      { label: 'Зайвих ходів', value: String(metrics.extra_moves) },
      {
        label: 'Обдумування до першого ходу',
        value: Number.isFinite(metrics.planning_ms) ? `${(metrics.planning_ms / 1000).toFixed(1)} с` : '—',
      },
    ],
    metrics,
  }
}
