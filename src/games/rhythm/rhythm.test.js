import { describe, it, expect } from 'vitest'
import { LONG, SHORT, beatTimes, checkAnswer, config, generateTrial } from './rhythm.config'

const trial = { gaps: [SHORT, SHORT, LONG] }

describe('перевірка ритму', () => {
  it('точне повторення — правильно, без відхилення', () => {
    const taps = beatTimes(trial, 300)
    expect(checkAnswer(trial, taps)).toEqual({ correct: true, errorPct: 0 })
  })

  it('повільніше, але з тим самим малюнком — теж правильно', () => {
    const taps = beatTimes(trial, 520).map((t) => t + 1000)
    expect(checkAnswer(trial, taps).correct).toBe(true)
  })

  it('рівне простукування там, де була довга пауза, — неправильно', () => {
    expect(checkAnswer(trial, [0, 400, 800, 1200]).correct).toBe(false)
  })

  it('довга й коротка переплутані — неправильно', () => {
    expect(checkAnswer(trial, [0, 600, 900, 1200]).correct).toBe(false)
  })

  it('інша кількість ударів — неправильно і без відхилення', () => {
    expect(checkAnswer(trial, [0, 300, 600])).toEqual({ correct: false, errorPct: undefined })
  })
})

describe('ритми', () => {
  it('довгий ритм має і короткі, і довгі паузи', () => {
    for (let i = 0; i < 100; i++) {
      const { gaps } = generateTrial(config.levels[2])
      expect(gaps.length).toBeGreaterThanOrEqual(4)
      expect(new Set(gaps).size).toBe(2)
    }
  })

  it('кількість ударів — у межах рівня', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 30; i++) {
        const beats = generateTrial(level).gaps.length + 1
        expect(beats).toBeGreaterThanOrEqual(level.beats[0])
        expect(beats).toBeLessThanOrEqual(level.beats[1])
      }
    }
  })
})
