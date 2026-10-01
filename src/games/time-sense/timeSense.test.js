import { describe, it, expect } from 'vitest'
import { biasPct, scoring } from './timeSense.config'

describe('відчуй час', () => {
  it('знак похибки: мінус — поспіх, плюс — затримка', () => {
    expect(biasPct(5000, 3000)).toBe(-40)
    expect(biasPct(5000, 6000)).toBe(20)
  })

  it('влучання — до ±15%', () => {
    const { metrics } = scoring([{ elapsedMs: 5700 }, { elapsedMs: 4300 }, { elapsedMs: 6000 }], 5000)
    expect(metrics.correct).toBe(2)
  })

  it('зберігає і похибку, і схильність окремо', () => {
    const { metrics, entries } = scoring([{ elapsedMs: 3000 }, { elapsedMs: 4000 }], 5000)
    expect(metrics.time_error_pct).toBe(30)
    expect(metrics.time_bias_pct).toBe(-30)
    expect(entries[2].value).toBe('поспішає на 30%')
  })
})
