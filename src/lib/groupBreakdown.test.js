import { describe, it, expect } from 'vitest'
import { aggregateAll, breakdownByGame, metricKeysOf, studentsWithoutAttempts } from './groupBreakdown'
import { aggregateMetric, METRIC_AGGREGATION, METRIC_LABELS } from '../games/engine/metrics'
import { GAMES } from '../data/games'

const STUDENTS = [
  { id: 'a', displayName: 'Аня' },
  { id: 'b', displayName: 'Богдан' },
]

const attempt = (over = {}) => ({
  user_id: 'a',
  game_id: 'schulte',
  score: 50,
  metrics: {},
  played_at: '2026-09-01T10:00:00Z',
  ...over,
})

describe('зведення одного показника', () => {
  /**
   * Головна пастка всього зрізу. Спроба з трьох проб і спроба з двадцяти дають
   * однаково «середній час», але важать вони різне. Без ваги коротка спроба
   * тягнула б середнє класу нарівні з довгою.
   */
  it('середній час зважується за кількістю вимірів', () => {
    const value = aggregateMetric('avg_rt_ms', [
      { avg_rt_ms: 1000, rt_count: 1 },
      { avg_rt_ms: 500, rt_count: 9 },
    ])

    // Зважене: (1000·1 + 500·9) / 10 = 550. Просте середнє дало б 750.
    expect(value).toBe(550)
  })

  it('точність зважується за кількістю проб', () => {
    const value = aggregateMetric('accuracy_pct', [
      { accuracy_pct: 100, total: 2 },
      { accuracy_pct: 50, total: 18 },
    ])

    // (100·2 + 50·18) / 20 = 55. Просте середнє дало б 75.
    expect(value).toBe(55)
  })

  it('найкращий час — це мінімум, а не середнє', () => {
    expect(aggregateMetric('best_rt_ms', [{ best_rt_ms: 400 }, { best_rt_ms: 250 }])).toBe(250)
  })

  it('обсяг памʼяті — це максимум досягнутого', () => {
    expect(aggregateMetric('span', [{ span: 4 }, { span: 6 }, { span: 5 }])).toBe(6)
  })

  it('лічильники додаються', () => {
    expect(aggregateMetric('total', [{ total: 10 }, { total: 8 }])).toBe(18)
    expect(aggregateMetric('errors', [{ errors: 1 }, { errors: 2 }])).toBe(3)
  })

  /**
   * Відсутність показника означає «ця гра цього не міряє», а не нуль. Спроба
   * без показника має випасти з розрахунку, а не занизити середнє.
   */
  it('спроби без показника не входять у розрахунок', () => {
    expect(aggregateMetric('accuracy_pct', [{ accuracy_pct: 80, total: 1 }, {}])).toBe(80)
    expect(aggregateMetric('accuracy_pct', [{}, {}])).toBeUndefined()
  })

  it('невідомий показник не зводиться взагалі', () => {
    expect(aggregateMetric('вигаданий', [{ вигаданий: 5 }])).toBeUndefined()
  })

  /**
   * Показник, для якого ніхто не сказав спосіб зведення, мовчки усереднився б —
   * і в зрізі зʼявилося б число, яке нічого не означає.
   */
  it('кожен показник зі словника підписів уміє зводитись', () => {
    const labelled = Object.keys(METRIC_LABELS)
    const missing = labelled.filter(
      (key) => !(key in METRIC_AGGREGATION) && key !== 'reached_target',
    )

    expect(missing, `без способу зведення: ${missing.join(', ')}`).toEqual([])
  })
})

describe('зріз за іграми', () => {
  const results = [
    attempt({ game_id: 'schulte', user_id: 'a', score: 80, metrics: { total: 10, accuracy_pct: 90, avg_rt_ms: 500, rt_count: 10 } }),
    attempt({ game_id: 'schulte', user_id: 'b', score: 40, metrics: { total: 10, accuracy_pct: 50, avg_rt_ms: 900, rt_count: 10 } }),
    attempt({ game_id: 'stroop', user_id: 'a', score: 60, metrics: { total: 8, accuracy_pct: 60 } }),
  ]

  it('групує спроби за грою', () => {
    const rows = breakdownByGame(results, STUDENTS)

    expect(rows.map((row) => row.gameId)).toEqual(['schulte', 'stroop'])
    expect(rows[0].attempts).toBe(2)
    expect(rows[0].players).toBe(2)
    expect(rows[1].players).toBe(1)
  })

  it('бере назву гри з каталогу', () => {
    const rows = breakdownByGame(results, STUDENTS)
    const schulte = GAMES.find((game) => game.id === 'schulte')

    expect(rows[0].title).toBe(schulte.title)
    expect(rows[0].category).toBe(schulte.category)
  })

  // Гра могла зникнути з каталогу, а спроби лишились.
  it('невідома гра не стає безіменним рядком', () => {
    const rows = breakdownByGame([attempt({ game_id: 'знята-з-каталогу' })], STUDENTS)

    expect(rows[0].title).toBe('знята-з-каталогу')
    expect(rows[0].category).toBeNull()
  })

  /**
   * Учитель шукає, кому потрібна допомога. Найслабший має бути зверху, інакше
   * його доводиться вишукувати очима внизу списку.
   */
  it('усередині гри учні впорядковані від найслабшого', () => {
    const rows = breakdownByGame(results, STUDENTS)

    expect(rows[0].students.map((student) => student.displayName)).toEqual(['Богдан', 'Аня'])
  })

  it('ігри впорядковані за кількістю спроб', () => {
    const rows = breakdownByGame(results, STUDENTS)

    expect(rows[0].attempts).toBeGreaterThanOrEqual(rows[1].attempts)
  })

  /**
   * Спроба видаленого учня роздувала б «скільки дітей грали» іменем, якого в
   * списку вже немає.
   */
  it('спроби чужого користувача не потрапляють у зріз', () => {
    const rows = breakdownByGame([...results, attempt({ user_id: 'хтось-інший' })], STUDENTS)
    const total = rows.reduce((sum, row) => sum + row.attempts, 0)

    expect(total).toBe(results.length)
  })

  it('порожній список дає порожній зріз, а не помилку', () => {
    expect(breakdownByGame([], STUDENTS)).toEqual([])
  })
})

describe('хто ще не грав', () => {
  /**
   * «Дитина цього не робила» і «дитина зробила погано» — різні речі. Порожня
   * клітинка має лишатись порожньою, а не нулем.
   */
  it('перелічує учнів без жодної спроби в цій грі', () => {
    const rows = breakdownByGame([attempt({ user_id: 'a' })], STUDENTS)

    expect(studentsWithoutAttempts(rows[0], STUDENTS).map((s) => s.displayName)).toEqual(['Богдан'])
  })

  it('коли грали всі — список порожній', () => {
    const rows = breakdownByGame([attempt({ user_id: 'a' }), attempt({ user_id: 'b' })], STUDENTS)

    expect(studentsWithoutAttempts(rows[0], STUDENTS)).toEqual([])
  })
})

describe('набір показників', () => {
  it('містить лише ті, що справді зустрічались', () => {
    const keys = metricKeysOf([
      { metrics: { total: 5, accuracy_pct: 80 } },
      { metrics: { total: 3, span: 4 } },
    ])

    expect(new Set(keys)).toEqual(new Set(['total', 'accuracy_pct', 'span']))
  })

  it('не тягне текст і булеві значення', () => {
    const keys = metricKeysOf([{ metrics: { total: 5, reached_target: true, note: 'текст' } }])

    expect(keys).toEqual(['total'])
  })

  it('aggregateAll зводить усе, що знайшов', () => {
    const summary = aggregateAll([
      { metrics: { total: 5, best_rt_ms: 400 } },
      { metrics: { total: 3, best_rt_ms: 250 } },
    ])

    expect(summary).toEqual({ total: 8, best_rt_ms: 250 })
  })
})
