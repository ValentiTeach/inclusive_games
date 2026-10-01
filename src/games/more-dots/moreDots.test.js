import { describe, it, expect } from 'vitest'
import { config, generateTrial, scatter } from './moreDots.config'

describe('хмарки', () => {
  it('більша хмарка більша рівно у відношення рівня (з округленням)', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 40; i++) {
        const trial = generateTrial(level)
        const larger = trial[trial.moreOn]
        const smaller = trial[trial.moreOn === 'left' ? 'right' : 'left']
        expect(larger).toBeGreaterThan(smaller)
        // Цілі крапки: 7,5 стає 8, тож відношення трохи гуляє навколо заданого.
        expect(Math.abs(larger / smaller - level.ratio)).toBeLessThanOrEqual(0.12)
      }
    }
  })

  it('крапки не налазять одна на одну і всі вміщаються', () => {
    const dots = scatter(24)
    expect(dots).toHaveLength(24)
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        expect(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)).toBeGreaterThan(dots[i].r + dots[j].r)
      }
    }
  })
})
