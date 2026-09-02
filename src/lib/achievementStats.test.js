import { describe, it, expect } from 'vitest'
import { computeAchievementStats } from './achievementStats'
import { ACHIEVEMENTS } from '../data/achievements'

function attempt(date, score) {
  return { date, score }
}

describe('computeAchievementStats', () => {
  it('returns empty stats for no games', () => {
    expect(computeAchievementStats([])).toEqual({
      totalAttempts: 0,
      dates: [],
      perfectCount: 0,
      distinctGamesPlayed: 0,
      categoryCounts: {},
    })
  })

  it('counts attempts per category across games', () => {
    const stats = computeAchievementStats([
      {
        game: { id: 'stroop', category: 'attention' },
        history: [attempt('2026-06-01T10:00:00Z', 50), attempt('2026-06-02T10:00:00Z', 60)],
      },
      {
        game: { id: 'n-back', category: 'memory' },
        history: [attempt('2026-06-01T11:00:00Z', 70)],
      },
    ])

    expect(stats.categoryCounts).toEqual({ attention: 2, memory: 1 })
    expect(stats.totalAttempts).toBe(3)
    expect(stats.distinctGamesPlayed).toBe(2)
  })

  it('counts only scores of 100 as perfect', () => {
    const stats = computeAchievementStats([
      {
        game: { id: 'schulte', category: 'attention' },
        history: [attempt('2026-06-01T10:00:00Z', 99), attempt('2026-06-02T10:00:00Z', 100)],
      },
    ])

    expect(stats.perfectCount).toBe(1)
  })

  it('reduces dates to plain days, dropping the time part', () => {
    const stats = computeAchievementStats([
      {
        game: { id: 'simon', category: 'memory' },
        history: [attempt('2026-06-01T23:59:00Z', 10)],
      },
    ])

    expect(stats.dates).toEqual(['2026-06-01'])
  })

  it('registers a category with zero attempts when a game has no history', () => {
    const stats = computeAchievementStats([
      { game: { id: 'simon', category: 'memory' }, history: [] },
    ])

    expect(stats.categoryCounts).toEqual({ memory: 0 })
    expect(stats.totalAttempts).toBe(0)
  })
})

describe('ACHIEVEMENTS', () => {
  const emptyStats = {
    totalAttempts: 0,
    longestStreak: 0,
    perfectCount: 0,
    distinctGamesPlayed: 0,
    categoryCounts: {},
  }

  it('unlocks nothing for a brand new user', () => {
    const unlocked = ACHIEVEMENTS.filter((a) => a.check(emptyStats))
    expect(unlocked).toEqual([])
  })

  it('never throws on stats missing a category key', () => {
    // categoryCounts only ever holds categories the user has actually played,
    // so every category check has to tolerate the key being absent.
    for (const achievement of ACHIEVEMENTS) {
      expect(() => achievement.check(emptyStats)).not.toThrow()
    }
  })

  it('unlocks "first-steps" on the very first attempt', () => {
    const first = ACHIEVEMENTS.find((a) => a.id === 'first-steps')
    expect(first.check({ ...emptyStats, totalAttempts: 1 })).toBe(true)
  })

  it('unlocks streak badges only at their thresholds', () => {
    const streak3 = ACHIEVEMENTS.find((a) => a.id === 'streak-3')
    expect(streak3.check({ ...emptyStats, longestStreak: 2 })).toBe(false)
    expect(streak3.check({ ...emptyStats, longestStreak: 3 })).toBe(true)
  })

  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
