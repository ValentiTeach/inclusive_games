import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import KeyboardTrainerPlayArea from './KeyboardTrainerPlayArea'
import {
  ALL_LETTERS,
  HOME_ROW,
  KEYBOARD_ROWS,
  config,
  generateTrial,
  letterForCode,
  scoring,
} from './keyboardTrainer.config'

function pressKey(key, code) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
    )
  })
}

function targetText() {
  return document.querySelector('.keyboard-trainer__target').textContent
}

function currentLetter() {
  return document.querySelector('.keyboard-trainer__char.is-current')?.textContent
}

function highlightedKeys() {
  return [...document.querySelectorAll('.keyboard-trainer__key.is-target')].map(
    (key) => key.textContent,
  )
}

describe('розкладка', () => {
  it('не має повторів — ані літер, ані клавіш', () => {
    const codes = KEYBOARD_ROWS.flat().map(([code]) => code)

    expect(new Set(ALL_LETTERS).size).toBe(ALL_LETTERS.length)
    expect(new Set(codes).size).toBe(codes.length)
  })

  // Домашній ряд — той, на якому лежать пальці; у ЙЦУКЕН це середній.
  it('домашній ряд — це середній ряд розкладки', () => {
    expect(HOME_ROW).toEqual(KEYBOARD_ROWS[1].map(([, letter]) => letter))
    expect(HOME_ROW).toContain('а')
    expect(HOME_ROW).toContain('о')
  })

  /**
   * Головна причина, чому код клавіші взагалі зберігається: на шкільному
   * комп'ютері часто стоїть англійська розкладка, і KeyF дає «f» замість «а».
   */
  it('знає, яку літеру дає фізична клавіша', () => {
    expect(letterForCode('KeyF')).toBe('а')
    expect(letterForCode('KeyA')).toBe('ф')
    expect(letterForCode('Quote')).toBe('є')
    expect(letterForCode('Escape')).toBeNull()
  })

  it('кожна гра має підказку клавіш', () => {
    expect(config.keyHint.keys).toBeTruthy()
  })
})

describe('generateTrial', () => {
  it('бере літери лише з домашнього ряду на першому рівні', () => {
    const level = config.levels[0]

    for (let i = 0; i < 40; i++) {
      expect(HOME_ROW).toContain(generateTrial(level).text)
    }
  })

  it('на рівні слів дає слово, а не літеру', () => {
    const word = generateTrial(config.levels[2]).text

    expect(word.length).toBeGreaterThan(2)
    for (const character of word) {
      expect(ALL_LETTERS, `«${character}» має бути на розкладці`).toContain(character)
    }
  })

  // Та сама літера двічі поспіль виглядає як зависла гра, а не як завдання.
  it('не повторює попереднє двічі поспіль', () => {
    const level = config.levels[0]

    for (let i = 0; i < 60; i++) {
      expect(generateTrial(level, 'а').text).not.toBe('а')
    }
  })
})

describe('scoring', () => {
  /**
   * Символів за хвилину рахується за сумою часів між натисканнями, а не за
   * годинником від початку гри: пауза, коли дитина відвернулась, інакше з'їдала
   * б увесь результат.
   */
  it('рахує символи за хвилину з часів між натисканнями', () => {
    // Чотири натискання по 500 мс — рівно 120 символів за хвилину.
    const { metrics } = scoring(
      Array.from({ length: 4 }, () => ({ correct: true, reactionTimeMs: 500 })),
    )

    expect(metrics.cpm).toBe(120)
    expect(metrics.chars).toBe(4)
  })

  it('переживає пробу без жодного виміряного часу', () => {
    const { metrics, score } = scoring([{ correct: true }])

    expect('cpm' in metrics).toBe(false)
    expect(score).toBe(100)
  })
})

describe('гра', () => {
  const level = config.levels[0]

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('підсвічує на клавіатурі саме ту клавішу, яку треба натиснути', () => {
    render(<KeyboardTrainerPlayArea level={level} onFinish={vi.fn()} />)

    expect(highlightedKeys()).toEqual([currentLetter()])
  })

  it('правильна клавіша веде до наступної проби', () => {
    render(<KeyboardTrainerPlayArea level={level} onFinish={vi.fn()} />)

    expect(screen.getByText(`1 / ${level.trialCount}`)).toBeInTheDocument()
    pressKey(currentLetter(), 'KeyF')

    expect(screen.getByText(`2 / ${level.trialCount}`)).toBeInTheDocument()
  })

  /**
   * Той самий фізичний палець, чужа розкладка. Рахувати це помилкою означало б
   * карати дитину за налаштування комп'ютера.
   */
  it('зараховує правильну клавішу навіть за англійської розкладки', () => {
    const onFinish = vi.fn()
    render(<KeyboardTrainerPlayArea level={level} onFinish={onFinish} />)

    for (let trial = 0; trial < level.trialCount; trial++) {
      const wanted = currentLetter()
      const code = KEYBOARD_ROWS.flat().find(([, letter]) => letter === wanted)[0]
      // key приходить англійський — саме так поводиться система з чужою мовою.
      pressKey('x', code)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.errors).toBe(0)
  })

  it('каже, що річ у розкладці, а не в дитині', () => {
    render(<KeyboardTrainerPlayArea level={level} onFinish={vi.fn()} />)

    const wanted = currentLetter()
    const code = KEYBOARD_ROWS.flat().find(([, letter]) => letter === wanted)[0]
    pressKey('x', code)

    expect(screen.getByText(/розкладка не українська/i)).toBeInTheDocument()
  })

  it('чужа літера рахується помилкою', () => {
    const onFinish = vi.fn()
    render(<KeyboardTrainerPlayArea level={level} onFinish={onFinish} />)

    const wrong = HOME_ROW.find((letter) => letter !== currentLetter())
    // Натискаємо іншу літеру з тієї ж розкладки: і key, і code чужі.
    pressKey(wrong, KEYBOARD_ROWS.flat().find(([, letter]) => letter === wrong)[0])

    for (let trial = 0; trial < level.trialCount; trial++) {
      const wanted = currentLetter()
      pressKey(wanted, KEYBOARD_ROWS.flat().find(([, letter]) => letter === wanted)[0])
    }

    expect(onFinish.mock.calls[0][0].metrics.errors).toBe(1)
  })

  /**
   * Телефон і планшет фізичної клавіатури не мають, тож екранна там не підказка,
   * а єдиний спосіб грати.
   */
  it('грається дотиком до екранної клавіатури', () => {
    render(<KeyboardTrainerPlayArea level={level} onFinish={vi.fn()} />)

    const wanted = currentLetter()
    // fireEvent, а не userEvent: той із фейковими таймерами чекає на реальний
    // час і зависає, а перевіряємо тут саме дотик, не траєкторію вказівника.
    fireEvent.click(screen.getByRole('button', { name: `Літера ${wanted}` }))

    expect(screen.getByText(`2 / ${level.trialCount}`)).toBeInTheDocument()
  })

  it('слово набирається по літері, а не одним натисканням', () => {
    const words = config.levels[2]
    render(<KeyboardTrainerPlayArea level={words} onFinish={vi.fn()} />)

    const word = targetText()
    expect(word.length).toBeGreaterThan(2)

    for (let index = 0; index < word.length - 1; index++) {
      expect(currentLetter()).toBe(word[index])
      pressKey(word[index], KEYBOARD_ROWS.flat().find(([, l]) => l === word[index])[0])
      // Поки слово не добране, проба та сама.
      expect(screen.getByText(`1 / ${words.trialCount}`)).toBeInTheDocument()
    }

    pressKey(word.at(-1), KEYBOARD_ROWS.flat().find(([, l]) => l === word.at(-1))[0])
    expect(screen.getByText(`2 / ${words.trialCount}`)).toBeInTheDocument()
  })
})
