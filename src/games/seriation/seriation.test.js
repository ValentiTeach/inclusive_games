import { describe, it, expect } from 'vitest'
import { checkAnswer, config, correctOrder, generateTrial, spread } from './seriation.config'

describe('серіація', () => {
  it('правильний порядок — від меншого до більшого', () => {
    for (let i = 0; i < 30; i++) {
      const trial = generateTrial(config.levels[1])
      const ordered = correctOrder(trial).map((id) => trial.items.find((item) => item.id === id))
      const key = trial.kind === 'time' ? 'rank' : 'value'
      for (let k = 1; k < ordered.length; k++) expect(ordered[k][key]).toBeGreaterThan(ordered[k - 1][key])
    }
  })

  it('значення в ряду різні — інакше порядок не був би однозначним', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 30; i++) {
        const trial = generateTrial(level)
        const ids = trial.items.map((item) => item.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('перевіряє весь ряд', () => {
    const trial = generateTrial(config.levels[0])
    expect(checkAnswer(trial, correctOrder(trial)).correct).toBe(true)
    expect(checkAnswer(trial, [...correctOrder(trial)].reverse()).correct).toBe(false)
  })
})

describe('розкид значень', () => {
  it('завжди дає потрібну кількість із запасом — без зависань', () => {
    for (let i = 0; i < 500; i++) {
      const values = spread(5, 24, 92, 12)
      expect(values).toHaveLength(5)
      for (let k = 1; k < values.length; k++) expect(values[k] - values[k - 1]).toBeGreaterThanOrEqual(12)
      expect(values[0]).toBeGreaterThanOrEqual(24)
      expect(values.at(-1)).toBeLessThanOrEqual(92)
    }
  })
})
