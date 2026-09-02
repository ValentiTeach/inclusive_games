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
