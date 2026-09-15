import { describe, it, expect } from 'vitest'
import { HIGHLIGHT_LIMIT, highlightMetrics, improvement } from './progressMetrics'

const attempt = (metrics, score = 50) => ({ score, metrics, date: '2026-09-01T10:00:00Z' })

describe('показники на картці гри', () => {
  /**
   * Дитині потрібен рекорд, а не середнє: «мій найшвидший час» мотивує, а
   * «середній час за всі спроби» — ні.
   */
  it('рекорд іде поперед середнього', () => {
    const shown = highlightMetrics([
      attempt({ best_rt_ms: 420, accuracy_pct: 80, total: 10, avg_rt_ms: 600, rt_count: 10 }),
    ])

    expect(shown[0].key).toBe('best_rt_ms')
  })

  it('бере найкраще з усіх спроб, а не з останньої', () => {
    const shown = highlightMetrics([
      attempt({ best_rt_ms: 700 }),
      attempt({ best_rt_ms: 380 }),
      attempt({ best_rt_ms: 520 }),
    ])

    expect(shown[0]).toEqual({ key: 'best_rt_ms', value: 380 })
  })

  it('обсяг памʼяті береться максимальний', () => {
    const shown = highlightMetrics([attempt({ span: 4 }), attempt({ span: 6 })])

    expect(shown).toContainEqual({ key: 'span', value: 6 })
  })

  it('не перетворює картку на таблицю', () => {
    const shown = highlightMetrics([
      attempt({
        best_rt_ms: 400,
        span: 5,
        cpm: 120,
        grid_size: 5,
        accuracy_pct: 90,
        total: 10,
        hits: 3,
      }),
    ])

    expect(shown).toHaveLength(HIGHLIGHT_LIMIT)
  })

  it('гра без показників не ламає картку', () => {
    expect(highlightMetrics([attempt({})])).toEqual([])
    expect(highlightMetrics([])).toEqual([])
  })
})

describe('поступ', () => {
  /**
   * Порівнюються середні половин, а не крайні спроби: одна вдала гра трапляється
   * випадково, і показувати її як зростання означало б обіцяти поступ, якого не
   * було.
   */
  it('рахує різницю між другою і першою половиною', () => {
    const history = [80, 80, 40, 40].map((score) => attempt({}, score))

    // history від найновішої: перші дві (старі) — 40 і 40, останні дві — 80.
    expect(improvement(history)).toBe(40)
  })

  it('падіння показується мінусом', () => {
    const history = [30, 30, 70, 70].map((score) => attempt({}, score))

    expect(improvement(history)).toBe(-40)
  })

  /**
   * З двох точок нічого чесного не скажеш, тож поступ просто не показується.
   */
  it('на коротенькій історії не рахується взагалі', () => {
    expect(improvement([attempt({}, 10), attempt({}, 90)])).toBeNull()
    expect(improvement([attempt({}, 10), attempt({}, 90), attempt({}, 50)])).toBeNull()
  })

  it('одна вдала спроба не видається за зростання', () => {
    const steady = [50, 50, 50, 50, 50, 99].map((score) => attempt({}, score))

    // Остання (найновіша) — 50; сплеск 99 стоїть у старій половині.
    expect(Math.abs(improvement(steady))).toBeLessThan(20)
  })
})
