import { describe, it, expect } from 'vitest'
import { goalProgress, goalTitle, metricOptions } from './goals'

const goal = {
  game_id: 'simon',
  level_id: null,
  metric: 'rounds_completed',
  target: 5,
  direction: 'at_least',
  due_on: '2026-12-01',
  created_at: '2026-10-01T00:00:00Z',
}

const attempt = (played_at, rounds) => ({
  game_id: 'simon',
  level_id: 'classic',
  score: 50,
  metrics: { rounds_completed: rounds },
  played_at,
})

describe('goalProgress', () => {
  it('uses the median of the last three attempts, not the best one', () => {
    const progress = goalProgress(
      goal,
      [
        attempt('2026-10-02T10:00:00Z', 6),
        attempt('2026-10-03T10:00:00Z', 3),
        attempt('2026-10-04T10:00:00Z', 4),
        // До постановки цілі — не рахується.
        attempt('2026-09-01T10:00:00Z', 9),
      ],
      new Date('2026-10-05T10:00:00'),
    )
    expect(progress.current).toBe(4)
    expect(progress.best).toBe(6)
    expect(progress.remaining).toBe(1)
    expect(progress.achieved).toBe(false)
    expect(progress.daysLeft).toBe(57)
  })

  it('lower-is-better goals count down', () => {
    const errors = { ...goal, metric: 'errors', target: 2, direction: 'at_most' }
    const progress = goalProgress(errors, [
      { ...attempt('2026-10-02T10:00:00Z', 0), metrics: { errors: 1 } },
    ])
    expect(progress.achieved).toBe(true)
    expect(progress.stable).toBe(false)
  })

  it('no attempts yet is not zero progress', () => {
    expect(goalProgress(goal, []).current).toBeNull()
  })

  it('reads like a sentence', () => {
    expect(goalTitle(goal)).toContain('≥ 5')
    expect(goalTitle(goal)).toMatch(/до 1 грудня: .+ ≥ 5 у грі «.+»/)
  })

  it('offers metrics the game really measured', () => {
    expect(metricOptions('simon', [attempt('2026-10-02T10:00:00Z', 3)])).toEqual([
      'score',
      'rounds_completed',
    ])
  })
})
