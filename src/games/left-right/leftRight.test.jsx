import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import LeftRightPlayArea from './LeftRightPlayArea'
import { PICTURES } from '../engine/pictures'
import { SCENE_OBJECTS, config, explain, generateTrial, screenSide, scoring } from './leftRight.config'

const [self, back, front, mixed] = config.levels

describe('чия це рука', () => {
  it('спиною — рука там само, де в того, хто дивиться', () => {
    expect(screenSide('back', 'left')).toBe('left')
    expect(screenSide('back', 'right')).toBe('right')
  })

  it('обличчям — навпаки, як у дзеркалі', () => {
    expect(screenSide('front', 'left')).toBe('right')
    expect(screenSide('front', 'right')).toBe('left')
  })

  it('на дзеркальних пробах кулька видна з протилежного боку від відповіді', () => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(front)
      expect(trial.side).not.toBe(trial.answer)
    }
  })

  it('у сцені бік на екрані — це і є відповідь', () => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(self)
      expect(trial.mode).toBe('scene')
      expect(trial.side).toBe(trial.answer)
    }
  })
})

describe('проби', () => {
  it('усі картинки сцени існують', () => {
    for (const [icon] of SCENE_OBJECTS) expect(PICTURES[icon], icon).toBeTruthy()
  })

  it('не більше трьох однакових відповідей поспіль', () => {
    const history = []
    for (let i = 0; i < 300; i++) history.push(generateTrial(back, history))
    let run = 1
    for (let i = 1; i < history.length; i++) {
      run = history[i].answer === history[i - 1].answer ? run + 1 : 1
      expect(run).toBeLessThanOrEqual(3)
    }
  })

  it('упереміш трапляються обидва положення', () => {
    const modes = new Set(Array.from({ length: 100 }, () => generateTrial(mixed).mode))
    expect(modes).toEqual(new Set(['back', 'front']))
  })

  it('пояснення після помилки називає правильну руку', () => {
    expect(explain({ mode: 'front', answer: 'right', side: 'left' })).toMatch(/правій/)
    expect(explain({ mode: 'scene', answer: 'left', side: 'left', object: { word: 'рибка' } })).toBe(
      'Рибка — ліворуч від будиночка.',
    )
  })
})

describe('бал', () => {
  it('помилки на дзеркальних пробах лічаться окремо', () => {
    const { metrics } = scoring([
      { correct: true, mode: 'back', reactionTimeMs: 800 },
      { correct: false, mode: 'front', reactionTimeMs: 900 },
      { correct: false, mode: 'back', reactionTimeMs: 900 },
    ])
    expect(metrics).toMatchObject({ total: 3, correct: 1, mirror_errors: 1 })
  })

  it('без дзеркальних проб показника немає зовсім', () => {
    const { metrics } = scoring([{ correct: true, mode: 'scene', reactionTimeMs: 800 }])
    expect(metrics).not.toHaveProperty('mirror_errors')
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('грається стрілками й доходить до результату', () => {
    const onFinish = vi.fn()
    render(<LeftRightPlayArea level={{ ...back, trialCount: 2 }} onFinish={onFinish} />)

    for (let i = 0; i < 2; i++) {
      expect(screen.getByRole('img', { name: 'Дитина стоїть спиною до тебе' })).toBeInTheDocument()
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
      })
      act(() => {
        vi.advanceTimersByTime(2500)
      })
    }

    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(2)
  })
})
