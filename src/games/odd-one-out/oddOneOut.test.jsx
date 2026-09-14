import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import OddOneOutPlayArea from './OddOneOutPlayArea'
import {
  DIMENSIONS,
  ambiguityOf,
  checkAnswer,
  config,
  generateTrial,
  oddByDimension,
} from './oddOneOut.config'

const ALL = config.levels[2]

describe('пошук зайвої за ознакою', () => {
  const items = [
    { id: 0, shape: 'circle', color: 'red', size: 22 },
    { id: 1, shape: 'square', color: 'red', size: 30 },
    { id: 2, shape: 'star', color: 'red', size: 38 },
    { id: 3, shape: 'cross', color: 'blue', size: 46 },
  ]

  it('знаходить ту, чиє значення не збігається з рештою', () => {
    expect(oddByDimension(items, 'color').id).toBe(3)
  })

  it('коли всі значення різні — зайвої за цією ознакою немає', () => {
    expect(oddByDimension(items, 'shape')).toBeNull()
    expect(oddByDimension(items, 'size')).toBeNull()
  })

  /**
   * Дві однакові плюс дві різні: «самотніх» значень тут два, тож жодне з них не
   * можна назвати зайвим. Без перевірки на кількість різних значень перше-ліпше
   * з них видавалося б за відповідь.
   */
  it('поділ «дві однакові й дві різні» не дає зайвої', () => {
    const spread = [
      { id: 0, color: 'red' },
      { id: 1, color: 'red' },
      { id: 2, color: 'blue' },
      { id: 3, color: 'green' },
    ]

    expect(oddByDimension(spread, 'color')).toBeNull()
  })

  it('поділ «два на два» теж не дає зайвої', () => {
    const split = [
      { id: 0, color: 'red' },
      { id: 1, color: 'red' },
      { id: 2, color: 'blue' },
      { id: 3, color: 'blue' },
    ]

    expect(oddByDimension(split, 'color')).toBeNull()
  })
})

describe('проба', () => {
  /**
   * Головна вимога до цієї гри. Якщо за кольором зайва одна фігура, а за
   * розміром — інша, дитина, яка помітила друге правило, буде «неправа», хоча
   * міркувала бездоганно.
   */
  it('має рівно одну зайву фігуру, за будь-якою ознакою', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 400; i++) {
        const trial = generateTrial(level)
        const odd = ambiguityOf(trial.items)

        expect(odd, `рівень ${level.id}`).toHaveLength(1)
        expect(odd[0]).toBe(trial.oddId)
      }
    }
  })

  /**
   * Решта ознак усередині трійки різні навмисно: якби три фігури збігалися ще й
   * формою, спільною ознакою можна було б назвати будь-яку з двох.
   */
  it('за побічними ознаками всі чотири фігури різні', () => {
    for (let i = 0; i < 400; i++) {
      const trial = generateTrial(ALL)
      const shared = trial.dimension

      for (const dimension of DIMENSIONS) {
        if (dimension === shared) continue
        const values = trial.items.map((item) => item[dimension])
        expect(new Set(values).size, `${dimension} у пробі за ${shared}`).toBe(4)
      }
    }
  })

  it('жодна фігура не лишається без ознаки', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 200; i++) {
        for (const item of generateTrial(level).items) {
          for (const dimension of DIMENSIONS) {
            expect(item[dimension], `${dimension} у ${level.id}`).toBeDefined()
          }
        }
      }
    }
  })

  it('рівень бере ознаки лише зі свого списку', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 200; i++) {
        expect(level.dimensions).toContain(generateTrial(level).dimension)
      }
    }
  })

  it('правильна відповідь — саме зайва фігура', () => {
    const trial = generateTrial(ALL)

    expect(checkAnswer(trial, trial.oddId).correct).toBe(true)
    const other = trial.items.find((item) => item.id !== trial.oddId)
    expect(checkAnswer(trial, other.id).correct).toBe(false)
  })

  it('порядок фігур перемішується, а не завжди той самий', () => {
    const positions = new Set()
    for (let i = 0; i < 60; i++) {
      const trial = generateTrial(ALL)
      positions.add(trial.items.findIndex((item) => item.id === trial.oddId))
    }

    expect(positions.size).toBeGreaterThan(1)
  })
})

describe('гра', () => {
  it('показує чотири фігури й питання', () => {
    render(<OddOneOutPlayArea level={ALL} onFinish={vi.fn()} />)

    expect(document.querySelectorAll('.odd__item')).toHaveLength(4)
    expect(screen.getByText('Яка фігура зайва?')).toBeInTheDocument()
  })

  it('клавіша вибирає ту саму фігуру, що й клік', () => {
    vi.useFakeTimers()
    const onFinish = vi.fn()
    render(<OddOneOutPlayArea level={{ ...ALL, trialCount: 1 }} onFinish={onFinish} />)

    const oddPosition = [...document.querySelectorAll('.odd__item')].findIndex((node) =>
      node.querySelector('.option-key'),
    )
    expect(oddPosition).toBe(0)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    })
    act(() => vi.advanceTimersByTime(700))

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(1)
    vi.useRealTimers()
  })
})
