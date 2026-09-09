import { describe, it, expect } from 'vitest'
import {
  defineMetrics,
  metricLabel,
  orderMetricKeys,
  timingMetrics,
  trialMetrics,
} from './metrics'

describe('defineMetrics', () => {
  /**
   * Відсутність ключа означає «гра цього не міряє», і саме на це спирається
   * агрегація: avg() пропускає такий рядок сам, а avg() по null-ах у jsonb
   * поводиться інакше залежно від того, як їх дістали.
   */
  it('drops what a game did not measure instead of storing null', () => {
    const metrics = defineMetrics({ total: 10, avg_rt_ms: undefined, best_rt_ms: null })

    expect(metrics).toEqual({ total: 10 })
    expect('avg_rt_ms' in metrics).toBe(false)
    expect('best_rt_ms' in metrics).toBe(false)
  })

  it('keeps a measured zero, which is not the same as unmeasured', () => {
    expect(defineMetrics({ errors: 0 })).toEqual({ errors: 0 })
  })

  it('keeps booleans, which some games do measure', () => {
    expect(defineMetrics({ reached_target: false })).toEqual({ reached_target: false })
  })

  it('drops NaN rather than writing it into jsonb', () => {
    expect(defineMetrics({ avg_rt_ms: Number.NaN })).toEqual({})
  })
})

describe('trialMetrics', () => {
  const results = [
    { correct: true, reactionTimeMs: 400 },
    { correct: true, reactionTimeMs: 600 },
    { correct: false, reactionTimeMs: 500 },
    { correct: true, reactionTimeMs: 300 },
  ]

  it('counts trials, hits and errors', () => {
    const metrics = trialMetrics(results)

    expect(metrics.total).toBe(4)
    expect(metrics.correct).toBe(3)
    expect(metrics.errors).toBe(1)
  })

  // 0–100, та сама шкала, що й score: частка 0–1 поруч зі score в одному рядку
  // таблиці — це те, як середнє тихо виходить у сто разів меншим.
  it('reports accuracy on the same 0-100 scale as the score', () => {
    expect(trialMetrics(results).accuracy_pct).toBe(75)
  })

  it('averages and picks the best reaction time', () => {
    const metrics = trialMetrics(results)

    expect(metrics.avg_rt_ms).toBe(450)
    expect(metrics.best_rt_ms).toBe(300)
  })

  /**
   * У Go/No-Go правильна відповідь — це часто саме *не* натиснути, і часу для
   * такої проби не існує. Якби середнє ділилося на кількість проб, а не на
   * кількість натискань, кожна прогавлена проба тягнула б його вниз як нуль.
   */
  it('averages over the trials that have a time, not over all trials', () => {
    const metrics = trialMetrics([
      { correct: true, reactionTimeMs: 400 },
      { correct: true },
      { correct: true },
    ])

    expect(metrics.avg_rt_ms).toBe(400)
    expect(metrics.rt_count).toBe(1)
    expect(metrics.total).toBe(3)
  })

  it('omits the timing keys for a game that measures no time at all', () => {
    const metrics = trialMetrics([{ correct: true }, { correct: false }])

    expect('avg_rt_ms' in metrics).toBe(false)
    expect('rt_count' in metrics).toBe(false)
    expect(metrics.accuracy_pct).toBe(50)
  })

  it('merges the game-specific keys alongside the shared ones', () => {
    const metrics = trialMetrics([{ correct: true }], { hits: 1, false_alarms: 0 })

    expect(metrics).toMatchObject({ total: 1, correct: 1, hits: 1, false_alarms: 0 })
  })

  it('survives an attempt with no trials', () => {
    const metrics = trialMetrics([])

    expect(metrics.total).toBe(0)
    expect('accuracy_pct' in metrics).toBe(false)
  })
})

describe('timingMetrics', () => {
  it('summarises a round of reaction times', () => {
    const metrics = timingMetrics([320, 410, 280])

    expect(metrics).toEqual({
      total: 3,
      rt_count: 3,
      avg_rt_ms: 337,
      best_rt_ms: 280,
      worst_rt_ms: 410,
    })
  })

  it('survives an empty round', () => {
    expect(timingMetrics([])).toEqual({ total: 0 })
  })
})

describe('orderMetricKeys / metricLabel', () => {
  it('puts the shared measurements before the game-specific ones', () => {
    expect(orderMetricKeys(['grid_size', 'avg_rt_ms', 'accuracy_pct'])).toEqual([
      'accuracy_pct',
      'avg_rt_ms',
      'grid_size',
    ])
  })

  // Нова метрика без підпису має поїхати в експорт під сирим ключем — краще
  // незрозуміла назва колонки, ніж тихо загублене вимірювання.
  it('keeps a key it has no label for, at the end', () => {
    expect(orderMetricKeys(['zebra_count', 'total'])).toEqual(['total', 'zebra_count'])
    expect(metricLabel('zebra_count')).toBe('zebra_count')
  })

  it('labels the shared keys in Ukrainian', () => {
    expect(metricLabel('avg_rt_ms')).toBe('Сер. час, мс')
  })
})
