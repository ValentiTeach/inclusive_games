import { describe, it, expect, vi } from 'vitest'
import { computeAchievementStats } from './achievementStats'
import { ACHIEVEMENTS, achievementProgress, isUnlocked } from '../data/achievements'

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
      distinctGamesByCategory: {},
      gamesWithPerfect: 0,
      gamesPlayedThrice: 0,
      mostCategoriesInADay: 0,
      longestPerfectRun: 0,
      attemptsToday: 0,
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

  /**
   * День береться за годинником дитини, а не за Гринвічем.
   *
   * 23:59 UTC першого червня — це вже 02:59 другого червня в Києві. Раніше
   * така спроба лягала у вчорашній день: серія днів обривалася на рівному
   * місці, а щоденна мета показувала вчорашній прогрес. Тест саме на цю мить,
   * бо будь-який інший час доби розбіжності не покаже.
   */
  it('відносить спробу до місцевого дня, а не до UTC-доби', () => {
    const stats = computeAchievementStats([
      {
        game: { id: 'simon', category: 'memory' },
        history: [attempt('2026-06-01T23:59:00Z', 10)],
      },
    ])

    expect(stats.dates).toEqual(['2026-06-02'])
  })

  it('удень обидва відліки збігаються', () => {
    const stats = computeAchievementStats([
      {
        game: { id: 'simon', category: 'memory' },
        history: [attempt('2026-06-01T12:00:00Z', 10)],
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
    const unlocked = ACHIEVEMENTS.filter((a) => isUnlocked(a, emptyStats))
    expect(unlocked).toEqual([])
  })

  it('never throws on stats missing a category key', () => {
    // categoryCounts only ever holds categories the user has actually played,
    // so every category check has to tolerate the key being absent.
    for (const achievement of ACHIEVEMENTS) {
      expect(() => achievementProgress(achievement, emptyStats)).not.toThrow()
    }
  })

  it('unlocks "first-steps" on the very first attempt', () => {
    const first = ACHIEVEMENTS.find((a) => a.id === 'first-steps')
    expect(isUnlocked(first, { ...emptyStats, totalAttempts: 1 })).toBe(true)
  })

  it('unlocks streak badges only at their thresholds', () => {
    const streak3 = ACHIEVEMENTS.find((a) => a.id === 'streak-3')
    expect(isUnlocked(streak3, { ...emptyStats, longestStreak: 2 })).toBe(false)
    expect(isUnlocked(streak3, { ...emptyStats, longestStreak: 3 })).toBe(true)
  })

  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('досягнення за вміння', () => {
  function game(id, category, history) {
    return { game: { id, category }, history }
  }

  /**
   * Ряд рахується по всіх іграх разом, у порядку часу. Рахувати всередині
   * кожної гри окремо було б легше, але означало б інше: дитина, яка чергує
   * ігри, ніколи не побачила б цього досягнення, хоча грала бездоганно.
   */
  it('ідеальний ряд тягнеться крізь різні ігри', () => {
    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-01T10:00:00Z', 100),
        attempt('2026-06-01T12:00:00Z', 100),
      ]),
      game('simon', 'memory', [attempt('2026-06-01T11:00:00Z', 100)]),
    ])

    expect(stats.longestPerfectRun).toBe(3)
  })

  it('неідеальна спроба посередині обриває ряд', () => {
    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-01T10:00:00Z', 100),
        attempt('2026-06-01T12:00:00Z', 100),
      ]),
      game('simon', 'memory', [attempt('2026-06-01T11:00:00Z', 40)]),
    ])

    expect(stats.longestPerfectRun).toBe(1)
  })

  it('чотири навички за день рахуються тільки в межах одного дня', () => {
    const sameDay = computeAchievementStats([
      game('schulte', 'attention', [attempt('2026-06-01T10:00:00Z', 50)]),
      game('simon', 'memory', [attempt('2026-06-01T11:00:00Z', 50)]),
      game('matrices', 'thinking', [attempt('2026-06-01T12:00:00Z', 50)]),
      game('reaction-time', 'reaction', [attempt('2026-06-01T13:00:00Z', 50)]),
    ])
    const spreadOut = computeAchievementStats([
      game('schulte', 'attention', [attempt('2026-06-01T10:00:00Z', 50)]),
      game('simon', 'memory', [attempt('2026-06-02T11:00:00Z', 50)]),
      game('matrices', 'thinking', [attempt('2026-06-03T12:00:00Z', 50)]),
      game('reaction-time', 'reaction', [attempt('2026-06-04T13:00:00Z', 50)]),
    ])

    expect(sameDay.mostCategoriesInADay).toBe(4)
    expect(spreadOut.mostCategoriesInADay).toBe(1)
  })

  it('рахує ігри з ідеальним результатом, а не самі ідеальні спроби', () => {
    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-01T10:00:00Z', 100),
        attempt('2026-06-02T10:00:00Z', 100),
        attempt('2026-06-03T10:00:00Z', 100),
      ]),
      game('simon', 'memory', [attempt('2026-06-01T11:00:00Z', 90)]),
    ])

    expect(stats.perfectCount).toBe(3)
    expect(stats.gamesWithPerfect).toBe(1)
  })

  it('«по три рази» — це саме три, а не дві', () => {
    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-01T10:00:00Z', 50),
        attempt('2026-06-02T10:00:00Z', 50),
      ]),
      game('simon', 'memory', [
        attempt('2026-06-01T10:00:00Z', 50),
        attempt('2026-06-02T10:00:00Z', 50),
        attempt('2026-06-03T10:00:00Z', 50),
      ]),
    ])

    expect(stats.gamesPlayedThrice).toBe(1)
  })

  it('рахує різні ігри в категорії, а не спроби в ній', () => {
    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-01T10:00:00Z', 50),
        attempt('2026-06-02T10:00:00Z', 50),
        attempt('2026-06-03T10:00:00Z', 50),
      ]),
      game('stroop', 'attention', [attempt('2026-06-01T11:00:00Z', 50)]),
      game('simon', 'memory', [attempt('2026-06-01T12:00:00Z', 50)]),
    ])

    expect(stats.categoryCounts.attention).toBe(4)
    expect(stats.distinctGamesByCategory).toEqual({ attention: 2, memory: 1 })
  })

  /**
   * Перша версія цього тесту будувала «сьогодні» через toISOString — тобто за
   * Гринвічем. Під мутацією, що повертала UTC-добу в сам код, фікстура й код
   * збігалися, і тест не бачив нічого. Тепер мить задається явно: 01:30 ночі
   * за Києвом, коли UTC-доба ще вчорашня.
   */
  it('сьогоднішні спроби рахуються за місцевим днем, а не за UTC', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T22:30:00Z')) // 01:30 шістнадцятого в Києві

    const stats = computeAchievementStats([
      game('schulte', 'attention', [
        attempt('2026-06-15T22:00:00Z', 50), // 01:00 шістнадцятого — сьогодні
        attempt('2026-06-15T21:30:00Z', 50), // 00:30 шістнадцятого — теж сьогодні
        attempt('2026-06-15T09:00:00Z', 50), // полудень п'ятнадцятого — учора
      ]),
    ])

    /*
     * Двоє проти одного навмисно: якби сьогоднішній день рахувався за UTC,
     * зарахувалася б рівно одна спроба — та, що вчорашня за київським часом.
     * Однакові кількості по обидва боки нічого б не розрізнили, і перша версія
     * цього тесту саме на цьому й попалася.
     */
    expect(stats.attemptsToday).toBe(2)
    vi.useRealTimers()
  })
})

describe('прогрес до досягнення', () => {
  const stats = { categoryCounts: { memory: 7 } }

  it('показує, скільки пройдено і скільки треба', () => {
    const badge = ACHIEVEMENTS.find((a) => a.id === 'category-memory')

    expect(achievementProgress(badge, stats)).toEqual({
      current: 7,
      target: 10,
      unlocked: false,
    })
  })

  /**
   * «12 із 10» на значку виглядає як помилка, а не як перевиконання — тому
   * пройдене обрізається по межі. Але сам факт здобуття від цього не залежить.
   */
  it('перевиконання не показує, але здобуття не втрачає', () => {
    const badge = ACHIEVEMENTS.find((a) => a.id === 'category-memory')

    expect(achievementProgress(badge, { categoryCounts: { memory: 12 } })).toEqual({
      current: 10,
      target: 10,
      unlocked: true,
    })
  })

  it('кожне досягнення має ціль, більшу за нуль', () => {
    for (const achievement of ACHIEVEMENTS) {
      const { target } = achievementProgress(achievement, {})
      expect(target, achievement.id).toBeGreaterThan(0)
    }
  })
})
