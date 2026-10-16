import { describe, it, expect } from 'vitest'
import { weeklyDigest } from './weeklyDigest'

const NOW = new Date('2026-10-15T12:00:00Z')
const daysAgo = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const OLYA = { id: 'olya', displayName: 'Оля' }
const PETRO = { id: 'petro', displayName: 'Петро' }
const IRA = { id: 'ira', displayName: 'Іра' }

function attempt(user, game, score, days, metrics = {}) {
  return { user_id: user.id, game_id: game, score, played_at: daysAgo(days), metrics }
}

describe('підсумок тижня', () => {
  it('рахує спроби тижня і тих, хто грав', () => {
    const digest = weeklyDigest({
      students: [OLYA, PETRO],
      results: [attempt(OLYA, 'schulte', 70, 1), attempt(OLYA, 'stroop', 60, 3), attempt(PETRO, 'schulte', 50, 20)],
      now: NOW,
    })
    expect(digest.attempts).toBe(2)
    expect(digest.activeCount).toBe(1)
  })

  it('не грали 7 днів — разом із тими, хто не грав ніколи, і вони першими', () => {
    const digest = weeklyDigest({
      students: [OLYA, PETRO, IRA],
      results: [attempt(OLYA, 'schulte', 70, 1), attempt(PETRO, 'schulte', 50, 20)],
      now: NOW,
    })
    expect(digest.inactive.map((entry) => entry.student.id)).toEqual(['ira', 'petro'])
    expect(digest.inactive[0].lastPlayed).toBeNull()
    expect(digest.inactive[1].lastPlayed).toBe(daysAgo(20))
  })

  /*
   * Бал різних ігор не порівнюється: Шульте 90 і Струп 40 — це не падіння на
   * 50. Падіння — у тій самій грі, тиждень проти чотирьох попередніх.
   */
  it('просідання — у тій самій грі, а не між різними', () => {
    const digest = weeklyDigest({
      students: [OLYA],
      results: [
        attempt(OLYA, 'schulte', 90, 10),
        attempt(OLYA, 'schulte', 86, 12),
        attempt(OLYA, 'stroop', 40, 1),
        attempt(OLYA, 'stroop', 42, 2),
      ],
      now: NOW,
    })
    expect(digest.drops).toEqual([])
  })

  it('помічає помітне падіння й помітне зростання', () => {
    const digest = weeklyDigest({
      students: [OLYA, PETRO],
      results: [
        attempt(OLYA, 'schulte', 80, 10),
        attempt(OLYA, 'schulte', 84, 14),
        attempt(OLYA, 'schulte', 55, 1),
        attempt(OLYA, 'schulte', 61, 2),
        attempt(PETRO, 'simon', 40, 9),
        attempt(PETRO, 'simon', 44, 15),
        attempt(PETRO, 'simon', 70, 2),
        attempt(PETRO, 'simon', 66, 3),
      ],
      now: NOW,
    })
    expect(digest.drops).toHaveLength(1)
    expect(digest.drops[0]).toMatchObject({ gameId: 'schulte', before: 82, now: 58, delta: -24 })
    expect(digest.drops[0].student.id).toBe('olya')
    expect(digest.rises[0]).toMatchObject({ gameId: 'simon', delta: 26 })
  })

  // Одна невдала гра — ще не падіння.
  it('не робить висновків з однієї спроби', () => {
    const digest = weeklyDigest({
      students: [OLYA],
      results: [attempt(OLYA, 'schulte', 90, 10), attempt(OLYA, 'schulte', 88, 12), attempt(OLYA, 'schulte', 20, 1)],
      now: NOW,
    })
    expect(digest.drops).toEqual([])
  })

  it('дрібні коливання не показує', () => {
    const digest = weeklyDigest({
      students: [OLYA],
      results: [
        attempt(OLYA, 'schulte', 80, 10),
        attempt(OLYA, 'schulte', 80, 12),
        attempt(OLYA, 'schulte', 70, 1),
        attempt(OLYA, 'schulte', 72, 2),
      ],
      now: NOW,
    })
    expect(digest.drops).toEqual([])
  })

  it('називає досягнуті цілі ІПР за правилом картки дитини', () => {
    const goal = {
      id: 'g1',
      student_id: 'olya',
      game_id: 'simon',
      level_id: null,
      metric: 'score',
      target: 60,
      direction: 'at_least',
      created_at: daysAgo(30),
      closed_at: null,
    }
    const reached = weeklyDigest({
      students: [OLYA],
      results: [attempt(OLYA, 'simon', 65, 1), attempt(OLYA, 'simon', 62, 2), attempt(OLYA, 'simon', 70, 3)],
      goals: [goal],
      now: NOW,
    })
    expect(reached.goalsReached).toHaveLength(1)

    const notYet = weeklyDigest({
      students: [OLYA],
      results: [attempt(OLYA, 'simon', 65, 1), attempt(OLYA, 'simon', 30, 2), attempt(OLYA, 'simon', 40, 3)],
      goals: [goal],
      now: NOW,
    })
    expect(notYet.goalsReached).toHaveLength(0)
  })
})
