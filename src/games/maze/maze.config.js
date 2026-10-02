import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Лабіринт — планування і гальмування: спершу знайти шлях очима, потім іти.
 *
 * Імпульсивна дитина рушає одразу, заходить у глухі кути й б'ється в стіни.
 * Тому міряється не швидкість, а якість руху: зайві кроки понад найкоротший
 * шлях, удари об стіни і час обдумування до першого кроку.
 */
export const DIRS = {
  up: { dx: 0, dy: -1, wall: 'n', opposite: 's' },
  down: { dx: 0, dy: 1, wall: 's', opposite: 'n' },
  left: { dx: -1, dy: 0, wall: 'w', opposite: 'e' },
  right: { dx: 1, dy: 0, wall: 'e', opposite: 'w' },
}

export const config = {
  ...gameInfo('maze'),
  instructions: [
    'Кулька стоїть у лівому верхньому куті, вихід — у правому нижньому.',
    'Веди кульку стрілками, кнопками або торкаючись сусідньої клітинки.',
    'Спершу знайди шлях очима — рахуються зайві кроки й удари об стіни.',
  ],
  keyHint: { keys: '← ↑ ↓ →', text: 'вести кульку' },
  practice: {
    hint: 'Не поспішай: проведи шлях очима від кульки до виходу. Тоді йди.',
    level: (level) => ({ ...level, trialCount: 1, size: 4 }),
  },
  levels: [
    { id: 'small', label: '5 × 5', trialCount: 2, size: 5 },
    { id: 'classic', label: '7 × 7', trialCount: 2, size: 7 },
    { id: 'large', label: '9 × 9', trialCount: 3, size: 9 },
  ],
}

/**
 * Лабіринт без циклів (досконалий): пошук у глибину з поверненням. У такому
 * лабіринті рівно один шлях між будь-якими двома клітинками, тож «найкоротший
 * шлях» однозначний.
 */
export function generateMaze(size, random = Math.random) {
  const cells = Array.from({ length: size * size }, () => ({ n: true, s: true, w: true, e: true }))
  const visited = new Set([0])
  const stack = [0]
  while (stack.length) {
    const current = stack.at(-1)
    const x = current % size
    const y = Math.floor(current / size)
    const options = Object.values(DIRS)
      .map((dir) => ({ dir, nx: x + dir.dx, ny: y + dir.dy }))
      .filter(({ nx, ny }) => nx >= 0 && ny >= 0 && nx < size && ny < size)
      .filter(({ nx, ny }) => !visited.has(ny * size + nx))
    if (!options.length) {
      stack.pop()
      continue
    }
    const { dir, nx, ny } = options[Math.floor(random() * options.length)]
    const next = ny * size + nx
    cells[current][dir.wall] = false
    cells[next][dir.opposite] = false
    visited.add(next)
    stack.push(next)
  }
  return { size, cells, start: 0, exit: size * size - 1 }
}

export function canMove(maze, cell, dirName) {
  return !maze.cells[cell][DIRS[dirName].wall]
}

export function step(maze, cell, dirName) {
  const dir = DIRS[dirName]
  return cell + dir.dy * maze.size + dir.dx
}

export function shortestPath(maze, from = maze.start, to = maze.exit) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const cell = queue.shift()
    if (cell === to) return distance.get(cell)
    for (const name of Object.keys(DIRS)) {
      if (!canMove(maze, cell, name)) continue
      const next = step(maze, cell, name)
      if (!distance.has(next)) {
        distance.set(next, distance.get(cell) + 1)
        queue.push(next)
      }
    }
  }
  return Infinity
}

export function generateTrial(level) {
  return generateMaze(level.size)
}

/** `results` — [{ moves, shortest, bumps, planningMs }] по одному на лабіринт. */
export function scoring(results) {
  const extra = results.reduce((sum, r) => sum + (r.moves - r.shortest), 0)
  const bumps = results.reduce((sum, r) => sum + r.bumps, 0)
  const planning = results.map((r) => r.planningMs).filter(Number.isFinite)
  const perfect = results.filter((r) => r.moves === r.shortest && r.bumps === 0).length
  const perMaze = results.map((r) =>
    clampScore((r.shortest / r.moves) * 100 - r.bumps * 5),
  )

  const metrics = defineMetrics({
    total: results.length,
    correct: perfect,
    errors: results.length - perfect,
    accuracy_pct: results.length ? Math.round((perfect / results.length) * 100) : undefined,
    moves: results.reduce((sum, r) => sum + r.moves, 0),
    extra_moves: extra,
    rule_breaks: bumps,
    planning_ms: planning.length
      ? Math.round(planning.reduce((sum, value) => sum + value, 0) / planning.length)
      : undefined,
  })

  return {
    score: perMaze.length ? clampScore(perMaze.reduce((s, v) => s + v, 0) / perMaze.length) : 0,
    entries: [
      { label: 'Зайвих кроків', value: String(extra) },
      { label: 'Ударів об стіни', value: String(bumps) },
      { label: 'Без жодної помилки', value: `${perfect} / ${results.length}` },
      {
        label: 'Обдумування до першого кроку',
        value: Number.isFinite(metrics.planning_ms) ? `${(metrics.planning_ms / 1000).toFixed(1)} с` : '—',
      },
    ],
    metrics,
  }
}
