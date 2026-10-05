import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AnalogiesPlayArea from './AnalogiesPlayArea'
import { PICTURES } from '../engine/pictures'
import { ITEMS, checkAnswer, config, generateTrial, pickItems, scoring } from './analogies.config'

const [easy, classic, hard] = config.levels

describe('задачі', () => {
  it('кожна картинка існує', () => {
    for (const item of ITEMS) {
      for (const [icon] of [item.a, item.b, item.c, item.answer, item.lure, ...item.others]) {
        expect(PICTURES[icon], icon).toBeTruthy()
      }
    }
  })

  it('у задачі немає двох однакових підписів серед варіантів', () => {
    for (const item of ITEMS) {
      const words = [item.answer, item.lure, ...item.others].map(([, word]) => word)
      expect(new Set(words).size, item.explain).toBe(words.length)
    }
  })

  it('кожен рівень має досить задач без повторів', () => {
    for (const level of config.levels) {
      const items = pickItems(level)
      expect(items).toHaveLength(level.trialCount)
      expect(new Set(items).size).toBe(items.length)
      for (const item of items) expect(level.tiers).toContain(item.tier)
    }
  })
})

describe('варіанти', () => {
  it('на легкому рівні — три варіанти і без приманки', () => {
    for (const item of ITEMS.filter((entry) => entry.tier === 1)) {
      const trial = generateTrial(easy, item)
      expect(trial.options).toHaveLength(3)
      expect(trial.options.map((option) => option.kind)).not.toContain('lure')
      expect(trial.options.filter((option) => option.kind === 'answer')).toHaveLength(1)
    }
  })

  it('на звичайному й складному — чотири, серед них приманка', () => {
    for (const level of [classic, hard]) {
      const trial = generateTrial(level, ITEMS.find((item) => level.tiers.includes(item.tier)))
      expect(trial.options).toHaveLength(4)
      expect(trial.options.filter((option) => option.kind === 'lure')).toHaveLength(1)
    }
  })

  it('вибір приманки — помилка, позначена окремо', () => {
    const item = ITEMS[0]
    const trial = generateTrial(classic, item)
    expect(checkAnswer(trial, item.lure[1])).toEqual({ correct: false, lure: true })
    expect(checkAnswer(trial, item.answer[1])).toEqual({ correct: true, lure: false })
  })
})

describe('бал', () => {
  it('приманки рахуються лише там, де вони були', () => {
    const results = [{ correct: false, lure: false, reactionTimeMs: 1000 }]
    expect(scoring(results, easy).metrics).not.toHaveProperty('lure_errors')
    expect(scoring([{ correct: false, lure: true, reactionTimeMs: 1000 }], classic).metrics.lure_errors).toBe(1)
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('показує відповідь і пояснення, а потім доходить до результату', () => {
    const onFinish = vi.fn()
    render(<AnalogiesPlayArea level={{ ...easy, trialCount: 1 }} onFinish={onFinish} />)

    expect(screen.getByLabelText('Знак питання')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.queryByLabelText('Знак питання')).not.toBeInTheDocument()
    expect(screen.getByText(/—/, { selector: '.analogies__explain' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(1)
  })
})
