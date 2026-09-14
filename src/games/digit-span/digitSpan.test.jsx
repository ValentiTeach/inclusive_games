import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import DigitSpanPlayArea from './DigitSpanPlayArea'
import {
  BLANK_MS,
  DIGIT_MS,
  LIVES,
  computeSpan,
  config,
  directionFor,
  expectedAnswer,
  isCorrect,
  makeSequence,
  scoring,
} from './digitSpan.config'

const FORWARD = config.levels[0]
const BACKWARD = config.levels[1]
const MIXED = config.levels[2]

describe('ряд цифр', () => {
  it('має задану довжину', () => {
    for (const length of [2, 5, 9]) {
      expect(makeSequence(length)).toHaveLength(length)
    }
  })

  /**
   * Дві однакові цифри поспіль читаються як одна довга: дитина не бачить межі
   * між ними, і помилка буде не про пам'ять.
   */
  it('не ставить дві однакові цифри поспіль', () => {
    for (let i = 0; i < 200; i++) {
      const digits = makeSequence(9)
      for (let k = 1; k < digits.length; k++) {
        expect(digits[k]).not.toBe(digits[k - 1])
      }
    }
  })

  it('користується всіма десятьма цифрами, включно з нулем', () => {
    const seen = new Set()
    for (let i = 0; i < 200; i++) for (const d of makeSequence(9)) seen.add(d)

    expect(seen.size).toBe(10)
  })
})

describe('напрямок', () => {
  it('зворотний ряд — це той самий ряд із кінця', () => {
    expect(expectedAnswer([1, 2, 3], 'backward')).toEqual([3, 2, 1])
    expect(expectedAnswer([1, 2, 3], 'forward')).toEqual([1, 2, 3])
  })

  it('відповідь перевіряється за напрямком проби', () => {
    expect(isCorrect([1, 2, 3], 'forward', [1, 2, 3])).toBe(true)
    expect(isCorrect([1, 2, 3], 'forward', [3, 2, 1])).toBe(false)
    expect(isCorrect([1, 2, 3], 'backward', [3, 2, 1])).toBe(true)
  })

  it('неповний набір не зараховується', () => {
    expect(isCorrect([1, 2, 3], 'forward', [1, 2])).toBe(false)
  })

  /**
   * Змішаний рівень чергує напрямки, а не кидає монету: інакше дитині могло б
   * випасти п'ять «назад» поспіль, і рівень перестав би бути змішаним.
   */
  it('змішаний рівень чергує напрямки', () => {
    const directions = [0, 1, 2, 3, 4, 5].map((i) => directionFor(MIXED, i))

    expect(directions).toEqual([
      'forward',
      'backward',
      'forward',
      'backward',
      'forward',
      'backward',
    ])
  })

  it('однонапрямлені рівні не змінюють напрямок', () => {
    expect(directionFor(FORWARD, 7)).toBe('forward')
    expect(directionFor(BACKWARD, 7)).toBe('backward')
  })
})

describe('обсяг пам’яті', () => {
  /**
   * Обсяг — найдовший *правильно* відтворений ряд, а не той, на якому дитина
   * зупинилась. Зупинка настає після двох помилок, тобто на довжині більшій за
   * досягнуту, і брати її означало б завищувати результат кожному.
   */
  it('це найдовший правильний ряд, а не довжина зупинки', () => {
    const span = computeSpan([
      { correct: true, length: 3 },
      { correct: true, length: 4 },
      { correct: false, length: 5 },
      { correct: false, length: 5 },
    ])

    expect(span).toBe(4)
  })

  it('без жодної правильної проби обсяг нульовий', () => {
    expect(computeSpan([{ correct: false, length: 3 }])).toBe(0)
    expect(computeSpan([])).toBe(0)
  })

  it('бал росте разом з обсягом', () => {
    const small = scoring([{ correct: true, length: 3 }])
    const big = scoring([{ correct: true, length: 6 }])

    expect(big.score).toBeGreaterThan(small.score)
  })

  it('обсяг видно і в числах, і на екрані', () => {
    const { metrics, entries } = scoring([
      { correct: true, length: 3 },
      { correct: false, length: 4 },
    ])
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics.span).toBe(3)
    expect(byLabel['Обсяг пам’яті']).toBe('3 цифр')
    expect(byLabel['Правильно']).toBe('1 / 2')
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function key(value) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
    })
  }

  /**
   * Пройти показ ряду, запам'ятовуючи цифри так само, як це робить дитина, —
   * по одній, поки вони на екрані. Інакше правильну відповідь у тесті нізвідки
   * взяти: ряд випадковий і компонент його не віддає.
   */
  function watchSequence(length) {
    const digits = []
    for (let i = 0; i < length; i++) {
      const shown = document.querySelector('.span__digit')?.textContent
      if (shown) digits.push(Number(shown))
      act(() => vi.advanceTimersByTime(DIGIT_MS))
      act(() => vi.advanceTimersByTime(BLANK_MS))
    }
    return digits
  }

  function answer(digits) {
    for (const digit of digits) key(String(digit))
    key('Enter')
    act(() => vi.advanceTimersByTime(1000))
  }

  function shownDigits() {
    return [...document.querySelectorAll('.span__digit')].map((n) => n.textContent)
  }

  it('показує цифри по одній, а не всі разом', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)

    const first = shownDigits()
    expect(first).toHaveLength(1)
    expect(first[0]).toMatch(/^\d$/)
  })

  it('після показу просить набрати ряд', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)
    watchSequence(FORWARD.startLength)

    expect(screen.getByText('Набери ряд по порядку')).toBeInTheDocument()
    expect(document.querySelectorAll('.span__key')).toHaveLength(10)
  })

  it('на рівні «назад» просить повторити з кінця', () => {
    render(<DigitSpanPlayArea level={BACKWARD} onFinish={vi.fn()} />)
    watchSequence(BACKWARD.startLength)

    expect(screen.getByText('Набери ряд з кінця')).toBeInTheDocument()
  })

  /**
   * Зайві цифри означали б, що дитина ще друкує, а не помилилась. Зараховувати
   * набране понад довжину ряду було б несправедливо.
   */
  it('не дає набрати більше цифр, ніж було в ряду', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)
    watchSequence(FORWARD.startLength)

    for (let i = 0; i < 8; i++) key('1')

    const typed = document.querySelector('.span__typed').textContent.trim().split(' ')
    expect(typed).toHaveLength(FORWARD.startLength)
  })

  it('Backspace стирає останню цифру', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)
    watchSequence(FORWARD.startLength)

    key('1')
    key('2')
    key('Backspace')

    expect(document.querySelector('.span__typed').textContent.trim()).toBe('1')
  })

  /**
   * Головне в цій грі: ряд довшає, поки дитина справляється. Без цього обсяг
   * ніколи не перевищив би стартову довжину, і гра міряла б не те, що обіцяє.
   */
  it('після правильної відповіді наступний ряд довший', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)

    const first = watchSequence(FORWARD.startLength)
    expect(first).toHaveLength(FORWARD.startLength)
    answer(first)

    expect(screen.getByText(new RegExp(`Ряд із ${FORWARD.startLength + 1} цифр`))).toBeInTheDocument()
  })

  it('після помилки довжина не падає, а лишається тією самою', () => {
    render(<DigitSpanPlayArea level={FORWARD} onFinish={vi.fn()} />)

    watchSequence(FORWARD.startLength)
    answer(Array(FORWARD.startLength).fill(0))

    expect(screen.getByText(new RegExp(`Ряд із ${FORWARD.startLength} цифр`))).toBeInTheDocument()
  })

  it('правильні відповіді підіймають обсяг вище стартової довжини', () => {
    const onFinish = vi.fn()
    render(<DigitSpanPlayArea level={FORWARD} onFinish={onFinish} />)

    let length = FORWARD.startLength
    for (let step = 0; step < 3; step++) {
      answer(watchSequence(length))
      length += 1
    }
    // Далі двічі помиляємось, щоб гра завершилась.
    for (let step = 0; step < LIVES; step++) {
      watchSequence(length)
      answer(Array(length).fill(0))
    }

    const { metrics } = onFinish.mock.calls[0][0]
    expect(metrics.span).toBe(FORWARD.startLength + 2)
  })

  /**
   * Дві помилки на одній довжині — це і є стеля: далі гра не має чого міряти.
   */
  it(`зупиняється після ${LIVES} помилок поспіль і віддає обсяг`, () => {
    const onFinish = vi.fn()
    render(<DigitSpanPlayArea level={FORWARD} onFinish={onFinish} />)

    for (let attempt = 0; attempt < LIVES; attempt++) {
      watchSequence(FORWARD.startLength)
      // Свідомо хибна відповідь: усі нулі поспіль ряд містити не може.
      for (let i = 0; i < FORWARD.startLength; i++) key('0')
      key('Enter')
      act(() => vi.advanceTimersByTime(1000))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.span).toBe(0)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(LIVES)
  })
})
