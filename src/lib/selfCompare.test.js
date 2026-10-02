import { describe, it, expect } from 'vitest'
import { compareWithPast, plural } from './selfCompare'

const NOW = new Date('2026-10-02T12:00:00Z')
const attempt = (daysAgo, metrics, extra = {}) => ({
  score: 50,
  levelId: 'classic',
  metrics,
  date: new Date(NOW - daysAgo * 86400000).toISOString(),
  ...extra,
})

describe('compareWithPast', () => {
  it('compares with last week when there is such an attempt', () => {
    const history = [attempt(1, { correct: 9 }), attempt(8, { correct: 7 })]
    const result = compareWithPast(history, attempt(0, { correct: 9 }), NOW)
    expect(result).toEqual({
      improved: true,
      text: 'Сьогодні — на 2 правильні відповіді більше, ніж минулого тижня.',
    })
  })

  it('falls back to the previous attempt', () => {
    const result = compareWithPast([attempt(1, { correct: 5 })], attempt(0, { correct: 6 }), NOW)
    expect(result.text).toContain('ніж минулого разу')
  })

  it('says nothing about a worse day', () => {
    expect(compareWithPast([attempt(1, { correct: 9 })], attempt(0, { correct: 4 }), NOW)).toBeNull()
  })

  it('a steady result is said kindly', () => {
    const result = compareWithPast([attempt(1, { correct: 6 })], attempt(0, { correct: 6 }), NOW)
    expect(result.improved).toBe(false)
    expect(result.text).toContain('стабільно')
  })

  it('faster is better for time', () => {
    const result = compareWithPast(
      [attempt(1, { duration_ms: 60000 })],
      attempt(0, { duration_ms: 52000 }),
      NOW,
    )
    expect(result.text).toBe('Сьогодні — на 8 с швидше, ніж минулого разу.')
  })

  it('never compares a short or relaxed attempt with a normal one', () => {
    expect(
      compareWithPast([attempt(1, { correct: 2 })], attempt(0, { correct: 5, short_attempt: true }), NOW),
    ).toBeNull()
    expect(
      compareWithPast([attempt(1, { correct: 2 }, { levelId: 'long' })], attempt(0, { correct: 5 }), NOW),
    ).toBeNull()
  })

  it('declines Ukrainian nouns', () => {
    expect(plural(1, 'а', 'б', 'в')).toBe('а')
    expect(plural(3, 'а', 'б', 'в')).toBe('б')
    expect(plural(11, 'а', 'б', 'в')).toBe('в')
    expect(plural(22, 'а', 'б', 'в')).toBe('б')
  })
})
