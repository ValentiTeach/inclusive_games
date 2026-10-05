import { shuffle } from '../engine/random'
import { clampScore } from '../engine/score'
import { defineMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Ланцюжок — Trail Making Test (Reitan) для дітей.
 *
 * Частина A («Числа») — зоровий пошук і темп: з'єднати 1 → 2 → 3… Частина B
 * («Число — літера») — те саме, але навперемінно: 1 → А → 2 → Б… Різниця між
 * ними і є головне: B вимагає щокроку тримати в голові два ряди й
 * перемикатися між ними. Саме тут видно дитину, яка «застрягає» в одному
 * правилі, — вона тисне 2 замість Б.
 *
 * «Коло — квадрат» — варіант без літер для тих, хто ще не знає абетки
 * (за ідеєю Color Trails Test, але формою, а не кольором: кольорова пара
 * недоступна дітям із порушеннями кольорового зору). Кожне число є двічі — у
 * колі й у квадраті, — і треба йти 1 у колі → 2 у квадраті → 3 у колі… Друге
 * таке саме число — пастка для того, хто не перемикається.
 */

/*
 * Українська абетка з Ґ на своєму місці. Пропустити її було б простіше, але
 * тоді гра вчила б неправильного порядку, а хибно вивчена абетка — це саме та
 * помилка, яку потім довго виправляє логопед.
 */
export const LETTERS = ['А', 'Б', 'В', 'Г', 'Ґ', 'Д', 'Е', 'Є', 'Ж']

/*
 * Поле 4 : 3 — має збігатися з aspect-ratio у TrailPlayArea.css. Відстані між
 * кружечками рахуються в одиницях висоти поля, тож ширина множиться на ASPECT.
 */
export const ASPECT = 4 / 3
const MARGIN_X = 6
const MARGIN_Y = 8

/* Секунд на один кружечок, за які дитина вкладається без штрафу за час. */
const IDEAL_SECONDS_PER_NODE = { numbers: 1.6, shapes: 2.4, letters: 2.6 }

export const config = {
  ...gameInfo('trail'),
  instructions: [
    'На полі розкидані кружечки. Натискай їх по порядку — за тобою тягнеться лінія.',
    'Спершу — лише числа: 1, 2, 3…',
    'На складніших рівнях — навперемінно: число, літера, число, літера (1, А, 2, Б…) або коло, квадрат, коло…',
  ],
  keyHint: { keys: '← ↑ ↓ → та Enter', text: 'перейти до кружечка й вибрати' },
  practice: {
    hint: (level) =>
      ({
        numbers: 'Натисни 1, потім 2, потім 3 — по порядку, поки числа не закінчаться.',
        shapes:
          'Чергуй: 1 у колі, 2 у квадраті, 3 у колі… Кожне число є двічі — обери те, що в потрібній фігурі.',
        letters: 'Чергуй число й літеру: 1, А, 2, Б, 3, В… Після числа — завжди літера.',
      })[level.kind],
    level: (level) => ({ ...level, size: level.kind === 'letters' ? 6 : 4 }),
  },
  relaxed: {
    note: 'Секундомір сховано, а бал рахується лише за помилками, не за часом.',
    rescore: (result) => ({
      ...result,
      score: clampScore(100 - (result.metrics.errors ?? 0) * 8),
    }),
  },
  levels: [
    { id: 'numbers', label: 'Числа', kind: 'numbers', size: 12 },
    { id: 'shapes', label: 'Коло — квадрат', kind: 'shapes', size: 10 },
    { id: 'letters', label: 'Число — літера', kind: 'letters', size: 12 },
  ],
}

/** Чи треба на цьому рівні перемикатися між двома рядами. */
export function alternates(level) {
  return level.kind !== 'numbers'
}

/**
 * Ланцюжок у правильному порядку і кружечки-пастки.
 * `group` — ряд, до якого належить кружечок: 'number' / 'letter' або форма.
 */
export function buildSequence(level) {
  const path = []
  const decoys = []

  if (level.kind === 'numbers') {
    for (let i = 1; i <= level.size; i++) {
      path.push({ id: `n${i}`, label: String(i), shape: 'circle', group: 'number' })
    }
  } else if (level.kind === 'shapes') {
    for (let i = 1; i <= level.size; i++) {
      const shape = i % 2 === 1 ? 'circle' : 'square'
      const other = shape === 'circle' ? 'square' : 'circle'
      path.push({ id: `${shape}${i}`, label: String(i), shape, group: shape })
      decoys.push({ id: `${other}${i}`, label: String(i), shape: other, group: other })
    }
  } else {
    for (let k = 0; k < level.size; k++) {
      if (k % 2 === 0) {
        const n = k / 2 + 1
        path.push({ id: `n${n}`, label: String(n), shape: 'circle', group: 'number' })
      } else {
        const letter = LETTERS[(k - 1) / 2]
        path.push({ id: `l${letter}`, label: letter, shape: 'circle', group: 'letter' })
      }
    }
  }

  return { path, decoys }
}

function distance(a, b) {
  return Math.hypot((a.x - b.x) * ASPECT, a.y - b.y)
}

/**
 * Розкидає `count` точок по полю так, щоб кружечки не налазили один на
 * одного. Починає з щедрої відстані й поступається, лише якщо точки не
 * вміщаються: дванадцять кружечків стоять просторо, двадцять — щільніше.
 * Координати — у відсотках поля.
 */
export function placeNodes(count, random = Math.random) {
  for (let minDistance = 26; minDistance >= 12; minDistance -= 2) {
    const points = []
    let attempts = 0
    while (points.length < count && attempts < 3000) {
      attempts++
      const point = {
        x: MARGIN_X + random() * (100 - 2 * MARGIN_X),
        y: MARGIN_Y + random() * (100 - 2 * MARGIN_Y),
      }
      if (points.every((other) => distance(point, other) >= minDistance)) points.push(point)
    }
    if (points.length === count) return points
  }

  // Запасний шлях, до якого на справжніх рівнях не доходить: сітка з
  // невеликим зсувом. Краще рівна сітка, ніж кружечки один на одному.
  const columns = Math.ceil(Math.sqrt(count * ASPECT))
  const rows = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, index) => ({
    x: MARGIN_X + ((index % columns) + 0.5) * ((100 - 2 * MARGIN_X) / columns),
    y: MARGIN_Y + (Math.floor(index / columns) + 0.5) * ((100 - 2 * MARGIN_Y) / rows),
  }))
}

/**
 * Поле однієї спроби. Кружечки йдуть у DOM у випадковому порядку: інакше Tab
 * і екранний читач підказували б наступний кружечок самим порядком.
 */
export function generateTrial(level, random = Math.random) {
  const { path, decoys } = buildSequence(level)
  const all = [...path, ...decoys]
  const points = placeNodes(all.length, random)
  const nodes = shuffle(all.map((node, index) => ({ ...node, ...points[index] })))
  return { kind: level.kind, path: path.map((node) => node.id), nodes }
}

/**
 * Один дотик до кружечка.
 *
 * - `correct` — це саме наступний у ланцюжку;
 * - `perseveration` — помилка «не перемкнувся»: обраний кружечок із того
 *   самого ряду, що й попередній правильний (2 замість Б, квадрат після
 *   квадрата). Рахується лише там, де перемикатися взагалі треба.
 */
export function checkTap(trial, step, node) {
  const expectedId = trial.path[step]
  if (node.id === expectedId) return { correct: true, perseveration: false }

  const byId = Object.fromEntries(trial.nodes.map((item) => [item.id, item]))
  const previous = step > 0 ? byId[trial.path[step - 1]] : null
  const perseveration = trial.kind !== 'numbers' && previous !== null && node.group === previous.group
  return { correct: false, perseveration }
}

/** Кружечок уже з'єднаний — повторний дотик до нього нічого не значить. */
export function isConnected(trial, step, nodeId) {
  return trial.path.slice(0, step).includes(nodeId)
}

export function scoring({ elapsedMs, errors, perseverations, level }) {
  const seconds = elapsedMs / 1000
  const nodes = level.size
  const ideal = nodes * IDEAL_SECONDS_PER_NODE[level.kind]
  const score = clampScore(100 - Math.max(0, seconds - ideal) * 2 - errors * 8)

  const metrics = defineMetrics({
    duration_ms: Math.round(elapsedMs),
    total: nodes,
    errors,
    perseverations: alternates(level) ? perseverations : undefined,
  })

  const entries = [
    { label: 'Час', value: `${seconds.toFixed(1)} с` },
    { label: 'Кружечків у ланцюжку', value: String(nodes) },
    { label: 'Помилкові натискання', value: String(errors) },
  ]
  if (alternates(level)) {
    entries.push({ label: 'З них — не перемкнувся', value: String(perseverations) })
  }

  return { score, entries, metrics }
}
