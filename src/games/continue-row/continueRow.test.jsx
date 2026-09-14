import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import ContinueRowPlayArea from './ContinueRowPlayArea'
import { RULE_IDS, checkAnswer, config, generateTrial, sameItem } from './continueRow.config'

const HARD = config.levels[2]

describe('ряд і правило', () => {
  it('ряд має довжину рівня', () => {
    for (const level of config.levels) {
      expect(generateTrial(level).sequence).toHaveLength(level.length)
    }
  })

  it('рівень бере правила лише зі свого списку', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 200; i++) {
        expect(level.rules).toContain(generateTrial(level).ruleId)
      }
    }
  })

  it('усі оголошені правила справді існують', () => {
    for (const level of config.levels) {
      for (const rule of level.rules) expect(RULE_IDS).toContain(rule)
    }
  })
})

describe('варіанти відповіді', () => {
  /**
   * Три варіанти замість чотирьох — це третина шансу вгадати замість чверті.
   * Виміряно на 9000 проб: із трьома значеннями в циклі 524 проби виходили
   * взагалі з двома варіантами.
   */
  it('їх завжди рівно чотири і всі різні', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 500; i++) {
        const { options } = generateTrial(level)

        expect(options, `рівень ${level.id}`).toHaveLength(4)
        const unique = options.filter(
          (option, index) => options.findIndex((other) => sameItem(other, option)) === index,
        )
        expect(unique).toHaveLength(4)
      }
    }
  })

  it('правильний варіант завжди серед них', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 300; i++) {
        const trial = generateTrial(level)
        expect(trial.options.some((option) => option.id === trial.correctId)).toBe(true)
      }
    }
  })

  /**
   * Хибні варіанти зібрані з ознак, які вже були в ряду. Фігура з кольором,
   * якого дитина не бачила, відкидається без розуміння правила — і гра міряла б
   * уважність, а не мислення.
   */
  it('усі ознаки варіантів зустрічалися в ряду', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 300; i++) {
        const { sequence, options } = generateTrial(level)
        const seen = {
          shape: new Set(sequence.map((item) => item.shape)),
          color: new Set(sequence.map((item) => item.color)),
          size: new Set(sequence.map((item) => item.size)),
        }

        for (const option of options) {
          for (const property of ['shape', 'color', 'size']) {
            expect(seen[property].has(option[property]), `${property} у ${level.id}`).toBe(true)
          }
        }
      }
    }
  })

  it('checkAnswer відрізняє правильний варіант від решти', () => {
    const trial = generateTrial(HARD)

    expect(checkAnswer(trial, trial.correctId).correct).toBe(true)
    const wrong = trial.options.find((option) => option.id !== trial.correctId)
    expect(checkAnswer(trial, wrong.id).correct).toBe(false)
  })

  /**
   * Найменший крок, через який ряд повторює сам себе. Усі правила гри
   * періодичні, тож наступний елемент — це той, що стояв рівно період тому.
   */
  function detectPeriod(sequence) {
    for (let period = 1; period <= sequence.length; period++) {
      const repeats = sequence.every(
        (item, index) => index < period || sameItem(item, sequence[index - period]),
      )
      if (repeats) return period
    }
    return sequence.length
  }

  /**
   * Головна перевірка гри: відповідь має *продовжувати* ряд, а не повторювати
   * останній побачений елемент. Без неї помилка «взяти поточний крок замість
   * наступного» проходила б усі інші тести — правильний варіант так само був би
   * серед чотирьох, так само не збігався б із сусідами, і ніщо б не вказало,
   * що дитину питають не про те.
   */
  it('правильна відповідь продовжує ряд, а не повторює останній елемент', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 300; i++) {
        const trial = generateTrial(level)
        const correct = trial.options.find((option) => option.id === trial.correctId)
        const period = detectPeriod(trial.sequence)

        expect(period, `рівень ${level.id}`).toBeLessThanOrEqual(trial.sequence.length)
        expect(
          sameItem(correct, trial.sequence[trial.sequence.length - period]),
          `${level.id}: період ${period}, відповідь мала б збігтися з елементом ${trial.sequence.length - period}`,
        ).toBe(true)
      }
    }
  })

  it('правильна відповідь не завжди на одному місці', () => {
    const positions = new Set()
    for (let i = 0; i < 60; i++) {
      const trial = generateTrial(HARD)
      positions.add(trial.options.findIndex((option) => option.id === trial.correctId))
    }

    expect(positions.size).toBeGreaterThan(1)
  })
})

describe('гра', () => {
  it('показує ряд, знак питання і чотири варіанти', () => {
    render(<ContinueRowPlayArea level={HARD} onFinish={vi.fn()} />)

    expect(document.querySelectorAll('.row-game__cell')).toHaveLength(HARD.length + 1)
    expect(document.querySelector('.row-game__cell--next').textContent).toBe('?')
    expect(document.querySelectorAll('.row-game__option')).toHaveLength(4)
    expect(screen.getByText('Що буде далі?')).toBeInTheDocument()
  })

  it('доходить до кінця і рахує всі проби', () => {
    vi.useFakeTimers()
    const onFinish = vi.fn()
    const level = { ...HARD, trialCount: 3 }
    render(<ContinueRowPlayArea level={level} onFinish={onFinish} />)

    for (let trial = 0; trial < level.trialCount; trial++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
      })
      act(() => vi.advanceTimersByTime(700))
    }

    expect(onFinish.mock.calls[0][0].metrics.total).toBe(level.trialCount)
    vi.useRealTimers()
  })
})
