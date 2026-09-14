import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import CatchTheMomentPlayArea from './CatchTheMomentPlayArea'
import {
  config,
  evaluate,
  positionAt,
  randomZone,
  scoring,
  zoneCenter,
} from './catchTheMoment.config'

const LEVEL = config.levels[1]

describe('рух бігунця', () => {
  it('починає ліворуч і доходить до правого краю за півперіоду', () => {
    expect(positionAt(0, 2000)).toBe(0)
    expect(positionAt(1000, 2000)).toBe(100)
    expect(positionAt(2000, 2000)).toBe(0)
  })

  /**
   * Трикутна хвиля, а не синус: при синусі бігунець гальмував би біля країв і
   * пролітав середину, тобто складність залежала б від того, де випала зона.
   * Перевіряємо рівномірність — однакові відрізки часу дають однаковий шлях.
   */
  it('рухається рівномірно, без гальмування біля країв', () => {
    const steps = [0, 100, 200, 300, 400, 500].map((t) => positionAt(t, 2000))
    const deltas = steps.slice(1).map((value, i) => value - steps[i])

    for (const delta of deltas) {
      expect(delta).toBeCloseTo(deltas[0], 6)
    }
  })

  it('цикл повторюється і не залежить від того, скільки часу минуло', () => {
    for (const t of [137, 894, 1503]) {
      expect(positionAt(t, 1900)).toBeCloseTo(positionAt(t + 1900 * 5, 1900), 6)
    }
  })

  it('ніколи не виходить за межі смуги', () => {
    for (let t = 0; t < 5000; t += 7) {
      const value = positionAt(t, 1400)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})

describe('зона', () => {
  /**
   * Біля країв бігунець розвертається і затримується довше, тож зона там
   * робила б гру вирішуваною простим затиском кнопки.
   */
  it('не притискається до країв смуги', () => {
    for (let i = 0; i < 200; i++) {
      const zone = randomZone(LEVEL)
      expect(zone.start).toBeGreaterThanOrEqual(8)
      expect(zone.end).toBeLessThanOrEqual(92)
      expect(zone.end - zone.start).toBe(LEVEL.zoneWidth)
    }
  })

  it('на вужчому рівні зона справді вужча', () => {
    const wide = randomZone(config.levels[0])
    const narrow = randomZone(config.levels[2])

    expect(wide.end - wide.start).toBeGreaterThan(narrow.end - narrow.start)
  })
})

describe('оцінка влучання', () => {
  const zone = { start: 40, end: 60 }

  it('влучання рахується від меж, а відхилення — від центру', () => {
    expect(evaluate(zone, 50)).toEqual({ hit: true, offsetPct: 0 })
    expect(evaluate(zone, 40)).toEqual({ hit: true, offsetPct: 10 })
    expect(evaluate(zone, 61)).toEqual({ hit: false, offsetPct: 11 })
  })

  it('центр зони — це її середина', () => {
    expect(zoneCenter(zone)).toBe(50)
  })

  /**
   * Дитина, яка щоразу зупиняє бігунець за крок від зони, і та, що тисне
   * навмання, однаково мають нуль влучань. Відхилення показує різницю — і саме
   * воно зменшується першим, коли з'являється прогрес.
   */
  it('два нулі влучань дають різний бал за різної точності', () => {
    const close = scoring([
      { hit: false, offsetPct: 12 },
      { hit: false, offsetPct: 11 },
    ])
    const random = scoring([
      { hit: false, offsetPct: 40 },
      { hit: false, offsetPct: 45 },
    ])

    expect(close.metrics.accuracy_pct).toBe(random.metrics.accuracy_pct)
    expect(close.score).toBeGreaterThan(random.score)
  })
})

describe('підсумок', () => {
  const results = [
    { hit: true, offsetPct: 2 },
    { hit: true, offsetPct: 4 },
    { hit: false, offsetPct: 12 },
  ]

  it('рядки на екрані збігаються з числами', () => {
    const { metrics, entries } = scoring(results)
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics).toMatchObject({
      total: 3,
      correct: 2,
      errors: 1,
      hits: 2,
      accuracy_pct: 67,
      avg_offset_pct: 6,
      best_offset_pct: 2,
    })
    expect(byLabel['Влучань']).toBe('2 / 3')
    expect(byLabel['Середнє відхилення']).toBe('6% смуги')
    expect(byLabel['Найточніше']).toBe('2% смуги')
  })

  /**
   * Зона на легкому рівні майже втричі ширша за вузьку, тож «влучив» там і тут
   * означає різне. Відхилення у відсотках смуги — та сама мірка на всіх рівнях.
   */
  it('бал рахується від відхилення, а не від кількості влучань', () => {
    const preciseMiss = scoring([{ hit: false, offsetPct: 1 }])
    const sloppyHit = scoring([{ hit: true, offsetPct: 13 }])

    expect(preciseMiss.score).toBeGreaterThan(sloppyHit.score)
  })

  it('порожній результат не дає NaN', () => {
    const { score, metrics } = scoring([])

    expect(score).toBe(0)
    expect('avg_offset_pct' in metrics).toBe(false)
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function pressSpace() {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }),
      )
    })
  }

  it('пробіл зупиняє бігунець і показує відхилення', () => {
    render(<CatchTheMomentPlayArea level={LEVEL} onFinish={vi.fn()} />)

    pressSpace()

    expect(screen.getByText(/смуги/)).toBeInTheDocument()
    // Підказка до дії зникає, щойно бігунець зупинено.
    expect(screen.queryByText(/Тисни, коли/)).not.toBeInTheDocument()
    expect(document.querySelector('.catch__marker.is-stopped')).toBeInTheDocument()
  })

  it('доходить до кінця і віддає стільки результатів, скільки раундів', () => {
    const onFinish = vi.fn()
    render(<CatchTheMomentPlayArea level={LEVEL} onFinish={onFinish} />)

    for (let round = 0; round < LEVEL.rounds; round++) {
      pressSpace()
      act(() => vi.advanceTimersByTime(800))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(LEVEL.rounds)
  })

  // Поки показується результат раунду, бігунець стоїть: друге натискання не
  // має дописати ще один результат у той самий раунд.
  it('поки видно підсумок раунду, друге натискання нічого не додає', () => {
    const onFinish = vi.fn()
    render(<CatchTheMomentPlayArea level={LEVEL} onFinish={onFinish} />)

    pressSpace()
    pressSpace()
    pressSpace()
    act(() => vi.advanceTimersByTime(800))

    for (let round = 1; round < LEVEL.rounds; round++) {
      pressSpace()
      act(() => vi.advanceTimersByTime(800))
    }

    expect(onFinish.mock.calls[0][0].metrics.total).toBe(LEVEL.rounds)
  })
})
