import { aggregateAll } from './groupBreakdown'

/**
 * Показники для сторінки «Мій прогрес».
 *
 * Дитині цікаве інше, ніж учителю. Учитель дивиться, як клас тримається за
 * грою, — там доречні середні. Дитині потрібен рекорд: «мій найшвидший час»,
 * «скільки цифр я запам'ятав». Тому порядок починається з тих показників, які
 * за своєю природою є найкращим досягненням (best_rt_ms зводиться мінімумом,
 * span — максимумом), і лише потім ідуть середні.
 */
const PRIORITY = [
  'best_rt_ms',
  'span',
  'cpm',
  'grid_size',
  'rounds_completed',
  'accuracy_pct',
  'best_offset_pct',
  'avg_rt_ms',
  'hits',
  'chars',
]

/** Скільки показників уміщається на картку гри, не перетворюючи її на таблицю. */
export const HIGHLIGHT_LIMIT = 3

/**
 * @param history спроби однієї гри: { score, metrics, date }
 */
export function highlightMetrics(history) {
  const summary = aggregateAll(history.map((attempt) => ({ metrics: attempt.metrics })))
  const chosen = PRIORITY.filter((key) => summary[key] !== undefined).slice(0, HIGHLIGHT_LIMIT)
  return chosen.map((key) => ({ key, value: summary[key] }))
}

/**
 * Наскільки виріс бал: середнє останніх спроб проти середнього перших.
 *
 * Порівнюються саме середні, а не крайні спроби: одна вдала гра трапляється
 * випадково, і показувати її як зростання означало б обіцяти дитині поступ,
 * якого не було. Менш ніж на чотирьох спробах не рахується взагалі — з двох
 * точок нічого чесного не скажеш.
 */
export function improvement(history) {
  if (history.length < 4) return null

  // history приходить від найновішої до найстарішої.
  const ordered = [...history].reverse()
  const half = Math.floor(ordered.length / 2)
  const mean = (list) => list.reduce((sum, item) => sum + item.score, 0) / list.length
  const before = mean(ordered.slice(0, half))
  const after = mean(ordered.slice(-half))

  return Math.round(after - before)
}
