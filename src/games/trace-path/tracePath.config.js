import { pickRandom } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Доріжка — зорово-моторна координація: провести лінію між двома краями.
 *
 * Підготовка руки до письма. Міряється не швидкість, а те, яку частку часу
 * палець провів у межах доріжки: дитина, що веде повільно й рівно, має
 * найкращий бал. На планшеті це найцінніша вправа для дітей із моторними
 * труднощами.
 */
export const VIEW = { width: 600, height: 300 }

const STEP = 4

/* Центральна лінія кожної доріжки — у координатах поля 600×300. */
const SHAPES = {
  line: () => polyline([[40, 150], [560, 150]]),
  wave: () => curve((t) => [40 + 520 * t, 150 + 70 * Math.sin(t * Math.PI * 2)]),
  'double-wave': () => curve((t) => [40 + 520 * t, 150 + 90 * Math.sin(t * Math.PI * 4)]),
  zigzag: () =>
    polyline([
      [40, 220],
      [150, 80],
      [260, 220],
      [370, 80],
      [480, 220],
      [560, 120],
    ]),
  meander: () =>
    polyline([
      [40, 210],
      [140, 210],
      [140, 90],
      [260, 90],
      [260, 210],
      [380, 210],
      [380, 90],
      [500, 90],
      [500, 210],
      [560, 210],
    ]),
}

function polyline(corners) {
  const points = []
  for (let i = 0; i < corners.length - 1; i++) {
    const [x1, y1] = corners[i]
    const [x2, y2] = corners[i + 1]
    const length = Math.hypot(x2 - x1, y2 - y1)
    const count = Math.max(1, Math.round(length / STEP))
    for (let k = 0; k < count; k++) {
      points.push({ x: x1 + ((x2 - x1) * k) / count, y: y1 + ((y2 - y1) * k) / count })
    }
  }
  const [x, y] = corners.at(-1)
  points.push({ x, y })
  return points
}

function curve(at) {
  // Густо, а потім рівномірно за довжиною: інакше на крутих ділянках точки
  // лягали б рідше, і прогрес стрибав би.
  const dense = Array.from({ length: 2001 }, (_, i) => at(i / 2000))
  return polyline(dense)
}

export const config = {
  ...gameInfo('trace-path'),
  instructions: [
    'Постав палець або мишу на зелене коло.',
    'Не відриваючи, веди доріжкою до прапорця. Намагайся не виходити за краї.',
    'Поспішати не треба: рахується, наскільки рівно, а не наскільки швидко.',
  ],
  keyHint: { keys: '← ↑ ↓ →', text: 'вести без миші' },
  practice: {
    hint: 'Натисни на зелене коло і, не відпускаючи, веди до прапорця. Тримайся всередині доріжки.',
    level: (level) => ({ ...level, trialCount: 1, shapes: ['line'] }),
  },
  levels: [
    { id: 'wide', label: 'Широка', trialCount: 2, width: 64, shapes: ['wave', 'zigzag'] },
    { id: 'classic', label: 'Звичайна', trialCount: 3, width: 46, shapes: ['wave', 'zigzag', 'meander'] },
    { id: 'narrow', label: 'Вузька', trialCount: 3, width: 30, shapes: ['double-wave', 'meander', 'zigzag'] },
  ],
}

export function generateTrial(level, previous) {
  const options = level.shapes.filter((shape) => shape !== previous?.shape)
  const shape = pickRandom(options.length ? options : level.shapes)
  return { shape, points: SHAPES[shape](), width: level.width }
}

/**
 * Найближча точка центральної лінії, але лише поблизу вже пройденого: інакше
 * на петлі чи зигзагу палець «перестрибував» би на сусідню ділянку і доріжка
 * зараховувалась би пройденою навпростець.
 */
export function nearest(points, position, from, ahead = 40) {
  let best = { index: from, distance: Infinity }
  const start = Math.max(0, from - 10)
  const end = Math.min(points.length - 1, from + ahead)
  for (let index = start; index <= end; index++) {
    const distance = Math.hypot(points[index].x - position.x, points[index].y - position.y)
    if (distance < best.distance) best = { index, distance }
  }
  return best
}

/**
 * Один рух пальця. Повертає новий стан проходження доріжки.
 * `weight` — скільки цей рух важить у часі (мс для миші, стала для клавіш).
 */
export function advance(state, trial, position, weight) {
  const { index, distance } = nearest(trial.points, position, state.progress)
  const inside = distance <= trial.width / 2
  return {
    progress: inside && index > state.progress ? index : state.progress,
    insideMs: state.insideMs + (inside ? weight : 0),
    outsideMs: state.outsideMs + (inside ? 0 : weight),
    exits: state.exits + (state.inside && !inside ? 1 : 0),
    inside,
  }
}

export function isFinished(state, trial) {
  return state.progress >= trial.points.length - 3
}

export function insidePct(state) {
  const total = state.insideMs + state.outsideMs
  return total > 0 ? Math.round((state.insideMs / total) * 100) : 100
}

export function scoring(paths, elapsedMs) {
  const shares = paths.map(insidePct)
  const mean = shares.length ? Math.round(shares.reduce((sum, value) => sum + value, 0) / shares.length) : 0
  const exits = paths.reduce((sum, path) => sum + path.exits, 0)

  const metrics = defineMetrics({
    total: paths.length,
    inside_pct: mean,
    exits,
    duration_ms: Math.round(elapsedMs),
  })

  return {
    score: clampScore(mean),
    entries: [
      { label: 'У межах доріжки', value: `${mean}% часу` },
      { label: 'Виходів за край', value: String(exits) },
      { label: 'Доріжок пройдено', value: String(paths.length) },
    ],
    metrics,
  }
}
