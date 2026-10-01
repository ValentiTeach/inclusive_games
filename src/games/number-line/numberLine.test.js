import { describe, it, expect } from 'vitest'
import { checkAnswer, config, errorPct, generateTrial, scoring, valueAt } from './numberLine.config'

const [ten, , hundred] = config.levels

describe('числова пряма', () => {
  it('похибка — у відсотках довжини прямої, тож рівні порівнянні', () => {
    expect(errorPct(ten, { target: 3 }, 4)).toBe(10)
    expect(errorPct(hundred, { target: 30 }, 40)).toBe(10)
  })

  it('влучання — у межах 5% прямої', () => {
    expect(checkAnswer(hundred, { target: 50 }, 54).correct).toBe(true)
    expect(checkAnswer(hundred, { target: 50 }, 56).correct).toBe(false)
  })

  it('точка поза прямою притискається до краю', () => {
    expect(valueAt(ten, -0.2)).toBe(0)
    expect(valueAt(ten, 1.4)).toBe(10)
    expect(valueAt(hundred, 0.373)).toBe(37.3)
  })

  it('не питає про підписані кінці', () => {
    for (let i = 0; i < 200; i++) {
      const { target } = generateTrial(ten)
      expect(target).toBeGreaterThan(0)
      expect(target).toBeLessThan(10)
    }
  })

  it('бал падає на чотири за кожен відсоток похибки', () => {
    expect(scoring([{ correct: true, errorPct: 5 }]).score).toBe(80)
  })
})
