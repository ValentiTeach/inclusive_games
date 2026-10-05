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
 *
 * Рівень «Обведи фігуру» — замкнений контур (коло, квадрат, трикутник, зірка,
 * будиночок): ті самі рухи, з яких потім складаються літери, і та сама вправа
 * «обведи по контуру», що на папері. Рахується так само — частка часу в межах.
 */
export const VIEW = { width: 600, height: 300 }

const STEP = 4

/* Центральна лінія кожної доріжки — у координатах поля 600×300. */
const SHAPES = {
  line: () => polyline([[40, 150], [560, 150]]),
  wave: () => curve((t) => [40 + 520 * t, 150 + 70 * Math.sin(t * Math.PI * 2)]),
  'double-wave': () => curve((t) => [40 + 520 * t, 150 + 90 * Math.sin(t * Math.PI * 4)]),
  // Спіраль від краю до центру. Між витками 50 одиниць — більше, ніж
  // найширша доріжка цього рівня, тож сусідні витки не зливаються.
  spiral: () =>
    curve((t) => {
      const angle = t * 1.9 * Math.PI * 2
      const r = 125 - t * 95
      return [300 + r * Math.cos(angle), 150 + r * Math.sin(angle)]
    }),
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

  // ── Замкнені контури: обвести фігуру й повернутися туди, звідки почав. ──
  // Старт посеред сторони, а не в куті: з кута незрозуміло, куди вести.
  circle: () =>
    curve((t) => {
      const angle = -Math.PI / 2 + t * Math.PI * 2
      return [300 + 120 * Math.cos(angle), 150 + 120 * Math.sin(angle)]
    }),
  square: () =>
    polyline([
      [300, 40],
      [410, 40],
      [410, 260],
      [190, 260],
      [190, 40],
      [300, 40],
    ]),
  triangle: () =>
    polyline([
      [300, 262],
      [435, 262],
      [300, 36],
      [165, 262],
      [300, 262],
    ]),
  // П'ять променів: внутрішній радіус узято майже вдвічі меншим за зовнішній,
  // щоб гострі кінці не злипалися — інакше на вершині доріжка налазила б сама
  // на себе і її можна було б зрізати.
  star: () => polyline(starCorners(300, 158, 128, 62)),
  house: () =>
    polyline([
      [300, 30],
      [425, 122],
      [425, 266],
      [175, 266],
      [175, 122],
      [300, 30],
    ]),
}

/** Замкнені фігури: старт і фініш в одній точці, тож прапорця не малюємо. */
export const CONTOURS = new Set(['circle', 'square', 'triangle', 'star', 'house'])

function starCorners(cx, cy, outer, inner) {
  const corners = []
  for (let k = 0; k <= 10; k++) {
    const radius = k % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (k * Math.PI) / 5
    corners.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)])
  }
  return corners
}

/**
 * Точки центральної лінії рівно через STEP одиниць довжини.
 *
 * Рівномірність тут не косметика: пошук найближчої точки дивиться на сорок
 * точок уперед, і це має означати однакову відстань на будь-якій доріжці.
 * Досі криві лишали всі дві тисячі густих точок по пів одиниці, і «сорок
 * уперед» на хвилі було вісімнадцять одиниць — швидкий, але рівний рух
 * зараховувався як вихід за край.
 */
function resample(path) {
  const points = [{ x: path[0][0], y: path[0][1] }]
  let carried = 0
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, y1] = path[i]
    const [x2, y2] = path[i + 1]
    const length = Math.hypot(x2 - x1, y2 - y1)
    let along = STEP - carried
    while (along <= length) {
      const t = along / length
      points.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t })
      along += STEP
    }
    carried = length - (along - STEP)
  }
  const [x, y] = path.at(-1)
  const last = points.at(-1)
  if (Math.hypot(last.x - x, last.y - y) > STEP / 4) points.push({ x, y })
  return points
}

function polyline(corners) {
  return resample(corners)
}

function curve(at) {
  return resample(Array.from({ length: 2001 }, (_, i) => at(i / 2000)))
}

export const config = {
  ...gameInfo('trace-path'),
  /*
   * Як профіль адаптацій торкається вводу (див. engine/AdaptivePlay). Тут
   * ведуть пальцем або ставлять мітку на прямій — перебирати нема чого, а
   * утримання змінило б саму дію.
   */
  input: { hold: false, scan: false },
  instructions: [
    'Постав палець або мишу на зелене коло.',
    'Не відриваючи, веди доріжкою до прапорця. Намагайся не виходити за краї.',
    'Поспішати не треба: рахується, наскільки рівно, а не наскільки швидко.',
    'На рівні «Обведи фігуру» веди по контуру за стрілкою і повернись туди, звідки почав.',
  ],
  keyHint: { keys: '← ↑ ↓ →', text: 'вести без миші' },
  practice: {
    hint: (level) =>
      level.id === 'contour'
        ? 'Натисни на зелене коло і, не відпускаючи, обведи коло за стрілкою — аж поки не повернешся на старт.'
        : 'Натисни на зелене коло і, не відпускаючи, веди до прапорця. Тримайся всередині доріжки.',
    level: (level) => ({ ...level, trialCount: 1, shapes: level.id === 'contour' ? ['circle'] : ['line'] }),
  },
  levels: [
    { id: 'wide', label: 'Широка', trialCount: 2, width: 64, shapes: ['wave', 'zigzag'] },
    { id: 'classic', label: 'Звичайна', trialCount: 3, width: 46, shapes: ['wave', 'zigzag', 'meander'] },
    { id: 'narrow', label: 'Вузька', trialCount: 3, width: 30, shapes: ['double-wave', 'meander', 'spiral'] },
    {
      id: 'contour',
      label: 'Обведи фігуру',
      trialCount: 3,
      width: 40,
      shapes: ['circle', 'square', 'triangle', 'star', 'house'],
    },
  ],
}

export function generateTrial(level, previous) {
  const options = level.shapes.filter((shape) => shape !== previous?.shape)
  const shape = pickRandom(options.length ? options : level.shapes)
  return { shape, points: SHAPES[shape](), width: level.width, closed: CONTOURS.has(shape) }
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
