import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import WhatVanishedPlayArea from './WhatVanishedPlayArea'
import {
  OPTION_COUNT,
  config,
  checkAnswer,
  gridShape,
  generateTrial,
  remainingItems,
  scoring,
} from './whatVanished.config'

const SIX = config.levels[1]

describe('набір предметів', () => {
  /**
   * Якби пари «форма + колір» повторювалися, на питання можна було б відповісти
   * частковою ознакою: «зник синій» звучить правильно, поки синіх двоє.
   */
  it('кожен предмет унікальний і за формою, і за кольором', () => {
    for (let i = 0; i < 40; i++) {
      const { items } = generateTrial(SIX)

      expect(new Set(items.map((item) => item.shape)).size).toBe(items.length)
      expect(new Set(items.map((item) => item.color)).size).toBe(items.length)
    }
  })

  it('набір має рівно стільки предметів, скільки обіцяє рівень', () => {
    for (const level of config.levels) {
      expect(generateTrial(level).items).toHaveLength(level.setSize)
    }
  })

  it('після зникнення лишається на один предмет менше', () => {
    const trial = generateTrial(SIX)
    const left = remainingItems(trial)

    expect(left).toHaveLength(SIX.setSize - 1)
    expect(left.some((item) => item.id === trial.missingId)).toBe(false)
  })
})

describe('форма сітки', () => {
  /**
   * Стала сітка на чотири колонки лишала порожній хвіст: шість предметів
   * ставали «4 + 2», а після зникнення одного — «4 + 1».
   */
  it('рядки набору приблизно рівні', () => {
    for (const level of config.levels) {
      const { columns, rows } = gridShape(level.setSize)
      const lastRow = level.setSize - columns * (rows - 1)

      expect(columns * rows).toBeGreaterThanOrEqual(level.setSize)
      expect(lastRow, `${level.setSize} предметів у ${columns} колонок`).toBeGreaterThan(columns / 2)
    }
  })

  it('чотири предмети стоять одним рядком', () => {
    expect(gridShape(4)).toEqual({ columns: 4, rows: 1 })
  })

  /**
   * Ключова властивість, а не дрібниця: якби кількість рядків падала, коли
   * предмет зникає, місце пропажі було б видно за самим зсувом блока — і
   * відповідь не треба було б пам'ятати.
   */
  it('після зникнення предмета кількість рядків не падає', () => {
    for (const level of config.levels) {
      const full = gridShape(level.setSize)
      const afterRemoval = Math.ceil((level.setSize - 1) / full.columns)

      expect(afterRemoval, `${level.setSize} предметів у ${full.columns} колонок`).toBe(full.rows)
    }
  })

  it('шість і вісім діляться на два рівні рядки', () => {
    expect(gridShape(6)).toEqual({ columns: 3, rows: 2 })
    expect(gridShape(8)).toEqual({ columns: 4, rows: 2 })
  })
})

describe('варіанти відповіді', () => {
  it('серед варіантів завжди є той, що зник', () => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(SIX)
      expect(trial.options.some((option) => option.id === trial.missingId)).toBe(true)
    }
  })

  /**
   * Хибні варіанти беруться з того самого набору. Чужий предмет видавав би себе
   * сам: його не було на екрані, і вибирати довелося б за впізнаванням, а не за
   * пам'яттю про набір.
   */
  it('усі варіанти були на екрані', () => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(SIX)
      const shownIds = new Set(trial.items.map((item) => item.id))

      for (const option of trial.options) {
        expect(shownIds.has(option.id)).toBe(true)
      }
    }
  })

  it('варіантів чотири і всі різні', () => {
    const trial = generateTrial(SIX)

    expect(trial.options).toHaveLength(OPTION_COUNT)
    expect(new Set(trial.options.map((o) => o.id)).size).toBe(OPTION_COUNT)
  })

  // На найменшому рівні предметів рівно стільки, скільки варіантів.
  it('на рівні з чотирьох предметів варіанти — це весь набір', () => {
    const trial = generateTrial(config.levels[0])

    expect(new Set(trial.options.map((o) => o.id))).toEqual(
      new Set(trial.items.map((i) => i.id)),
    )
  })

  it('правильна відповідь — саме зниклий предмет', () => {
    const trial = generateTrial(SIX)

    expect(checkAnswer(trial, trial.missingId).correct).toBe(true)
    const other = trial.options.find((o) => o.id !== trial.missingId)
    expect(checkAnswer(trial, other.id).correct).toBe(false)
  })
})

describe('підсумок', () => {
  it('розмір набору потрапляє і в числа, і на екран', () => {
    const { metrics, entries } = scoring(
      [
        { correct: true, reactionTimeMs: 900 },
        { correct: false, reactionTimeMs: 1200 },
      ],
      { set_size: 8 },
    )
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics.set_size).toBe(8)
    expect(byLabel['Предметів у наборі']).toBe('8')
    expect(byLabel['Точність']).toBe('50%')
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /*
   * Два кроки, а не один: показ і порожня мить — це дві окремі фази, і ефект
   * другої створює свій таймер лише після того, як React закомітить першу.
   * Один advanceTimersByTime проходив би лише перший перехід.
   */
  function reachQuestion(level) {
    act(() => vi.advanceTimersByTime(level.showMs))
    act(() => vi.advanceTimersByTime(700))
  }

  it('спершу показує весь набір, без варіантів відповіді', () => {
    render(<WhatVanishedPlayArea level={SIX} onFinish={vi.fn()} />)

    expect(document.querySelectorAll('.vanished__item')).toHaveLength(SIX.setSize)
    expect(document.querySelectorAll('.vanished__option')).toHaveLength(0)
    expect(screen.getByText(/Запам/)).toBeInTheDocument()
  })

  /**
   * Варіанти показані разом із набором підказували б, на які саме предмети
   * дивитися уважніше, — і гра міряла б не пам'ять, а вміння читати підказку.
   */
  it('варіанти з’являються лише після зникнення', () => {
    render(<WhatVanishedPlayArea level={SIX} onFinish={vi.fn()} />)
    reachQuestion(SIX)

    expect(document.querySelectorAll('.vanished__option')).toHaveLength(OPTION_COUNT)
    expect(document.querySelectorAll('.vanished__item')).toHaveLength(SIX.setSize - 1)
    expect(screen.getByText('Що зникло?')).toBeInTheDocument()
  })

  it('до питання клавіші нічого не роблять', () => {
    const onFinish = vi.fn()
    render(<WhatVanishedPlayArea level={SIX} onFinish={onFinish} />)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    })

    // Досі фаза показу: жодної відповіді не записано.
    expect(screen.getByText(/Запам/)).toBeInTheDocument()
    reachQuestion(SIX)
    expect(screen.getByText('Що зникло?')).toBeInTheDocument()
  })

  it('доходить до кінця і рахує стільки проб, скільки в рівні', () => {
    const onFinish = vi.fn()
    const level = config.levels[0]
    render(<WhatVanishedPlayArea level={level} onFinish={onFinish} />)

    for (let trial = 0; trial < level.trialCount; trial++) {
      reachQuestion(level)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
      })
      act(() => vi.advanceTimersByTime(800))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(level.trialCount)
    expect(onFinish.mock.calls[0][0].metrics.set_size).toBe(level.setSize)
  })
})
