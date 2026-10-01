import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Відчуй час — оцінка часових інтервалів без годинника.
 *
 * Імпульсивні діти систематично натискають зарано: їм здається, що час минув,
 * коли не минуло й половини. Тому, крім похибки, окремо зберігається її знак
 * (`time_bias_pct`): мінус — поспішає, плюс — затримується. Для фахівця саме
 * знак цікавіший за точність.
 */
export const config = {
  ...gameInfo('time-sense'),
  instructions: [
    'Натисни «Старт» — і подумки рахуй час. Годинника не буде.',
    'Коли, на твою думку, мине потрібна кількість секунд, натисни «Стоп».',
    'Після кожної спроби побачиш, скільки минуло насправді.',
  ],
  keyHint: { keys: 'Пробіл', text: 'старт / стоп' },
  practice: {
    hint: 'Рахуй повільно: «раз-і-два-і-три-і…». Кожне «і» — пів секунди.',
  },
  levels: [
    { id: 'three', label: '3 секунди', trialCount: 5, targetMs: 3000 },
    { id: 'five', label: '5 секунд', trialCount: 6, targetMs: 5000 },
    { id: 'ten', label: '10 секунд', trialCount: 6, targetMs: 10000 },
  ],
}

/** Знакова похибка у відсотках: −40 — зупинився на 40% раніше. */
export function biasPct(targetMs, elapsedMs) {
  return Math.round(((elapsedMs - targetMs) / targetMs) * 100)
}

/* Влучанням вважається похибка до 15%: на 5 секундах це ±0,75 с. */
export const HIT_PCT = 15

export function scoring(results, targetMs) {
  const biases = results.map((r) => biasPct(targetMs, r.elapsedMs))
  const errors = biases.map(Math.abs)
  const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0)
  const hits = errors.filter((value) => value <= HIT_PCT).length

  const metrics = defineMetrics({
    total: results.length,
    correct: hits,
    errors: results.length - hits,
    accuracy_pct: results.length ? Math.round((hits / results.length) * 100) : undefined,
    time_error_pct: results.length ? Math.round(mean(errors)) : undefined,
    time_bias_pct: results.length ? Math.round(mean(biases)) : undefined,
  })

  const bias = metrics.time_bias_pct ?? 0
  return {
    score: results.length ? clampScore(100 - mean(errors) * 2) : 0,
    entries: [
      { label: 'Влучань (±15%)', value: `${hits} / ${results.length}` },
      { label: 'Середня похибка', value: `${metrics.time_error_pct ?? 0}%` },
      {
        label: 'Схильність',
        value: Math.abs(bias) < 5 ? 'рівно' : bias < 0 ? `поспішає на ${-bias}%` : `затримується на ${bias}%`,
      },
    ],
    metrics,
  }
}
