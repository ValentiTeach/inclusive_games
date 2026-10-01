import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import DayNightPlayArea from './DayNightPlayArea'
import { config, expectedAnswer, generateTrial } from './dayNight.config'

describe('правило «навпаки»', () => {
  it('на сонце — «Ніч», на місяць — «День»', () => {
    expect(expectedAnswer({ picture: 'sun', rule: 'inverse' })).toBe('night')
    expect(expectedAnswer({ picture: 'moon', rule: 'inverse' })).toBe('day')
  })

  it('знак «=» повертає звичайне правило', () => {
    expect(expectedAnswer({ picture: 'sun', rule: 'same' })).toBe('day')
  })

  it('на рівнях без змін правило завжди «навпаки»', () => {
    for (let i = 0; i < 50; i++) expect(generateTrial(config.levels[0]).rule).toBe('inverse')
  })

  it('на змішаному рівні трапляються обидва правила', () => {
    const rules = new Set(Array.from({ length: 200 }, () => generateTrial(config.levels[2]).rule))
    expect(rules).toEqual(new Set(['inverse', 'same']))
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('грається клавішами 1 і 2 і рахує всі проби', () => {
    const onFinish = vi.fn()
    render(<DayNightPlayArea level={{ ...config.levels[0], trialCount: 2 }} onFinish={onFinish} />)

    for (let i = 0; i < 2; i++) {
      const picture = screen.getByRole('img').getAttribute('aria-label')
      const key = picture === 'Сонце' ? '2' : '1'
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      })
      act(() => {
        vi.advanceTimersByTime(600)
      })
    }

    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0].metrics).toMatchObject({ total: 2, correct: 2 })
  })
})
