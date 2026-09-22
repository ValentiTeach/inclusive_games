import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeStreak } from './streak'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n) {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

describe('computeStreak', () => {
  beforeEach(() => {
    // Pinned so "today" can't drift mid-run and can't land on a DST boundary,
    // which would make the day arithmetic ambiguous.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zeros for no history', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 })
  })

  it('counts a single day as a streak of one', () => {
    expect(computeStreak([daysAgo(0)])).toEqual({ current: 1, longest: 1 })
  })

  it('counts consecutive days ending today', () => {
    expect(computeStreak([daysAgo(2), daysAgo(1), daysAgo(0)])).toEqual({
      current: 3,
      longest: 3,
    })
  })

  it('keeps the current streak alive when the last play was yesterday', () => {
    expect(computeStreak([daysAgo(2), daysAgo(1)])).toEqual({ current: 2, longest: 2 })
  })

  it('drops the current streak to zero once two days are missed', () => {
    const { current, longest } = computeStreak([daysAgo(4), daysAgo(3), daysAgo(2)])
    expect(current).toBe(0)
    expect(longest).toBe(3)
  })

  it('remembers the longest past streak even after a gap', () => {
    const dates = [daysAgo(10), daysAgo(9), daysAgo(8), daysAgo(7), daysAgo(1), daysAgo(0)]
    expect(computeStreak(dates)).toEqual({ current: 2, longest: 4 })
  })

  it('ignores duplicate plays on the same day', () => {
    expect(computeStreak([daysAgo(1), daysAgo(1), daysAgo(0), daysAgo(0)])).toEqual({
      current: 2,
      longest: 2,
    })
  })

  it('does not depend on the input being sorted', () => {
    const sorted = computeStreak([daysAgo(2), daysAgo(1), daysAgo(0)])
    const shuffled = computeStreak([daysAgo(0), daysAgo(2), daysAgo(1)])
    expect(shuffled).toEqual(sorted)
  })
})

describe('серія за місцевим часом', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Дитина грала вчора і сьогодні о першій ночі. За Гринвічем обидві спроби
   * припадають на вчора — серія обірвалася б на рівному місці.
   */
  it('гра після місцевої півночі продовжує серію, а не обриває', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T22:30:00Z')) // 01:30 шістнадцятого в Києві

    expect(computeStreak(['2026-06-15', '2026-06-16'])).toMatchObject({ current: 2 })
  })

  it('учорашня гра тримає серію, поки не минув сьогоднішній день', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T09:00:00Z'))

    expect(computeStreak(['2026-06-14', '2026-06-15'])).toMatchObject({ current: 2 })
  })

  it('позавчорашня гра серію вже не тримає', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T09:00:00Z'))

    expect(computeStreak(['2026-06-13', '2026-06-14'])).toMatchObject({ current: 0 })
  })

  /**
   * Курсор іде по календарних днях, а не по мілісекундах: інакше ніч переходу
   * на зимовий час зарахувала б той самий день двічі й завищила серію.
   */
  it('перехід на зимовий час не задвоює день у серії', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T09:00:00Z'))

    expect(computeStreak(['2026-10-24', '2026-10-25', '2026-10-26'])).toMatchObject({
      current: 3,
      longest: 3,
    })
  })
})
