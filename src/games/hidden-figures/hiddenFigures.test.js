import { describe, it, expect } from 'vitest'
import { FIGURES, checkAnswer, config, generateTrial, scoring } from './hiddenFigures.config'
import { PICTURES } from '../engine/pictures'

describe('накладені фігури', () => {
  it('кожна картинка існує', () => {
    for (const [icon] of FIGURES) expect(PICTURES[icon], icon).toBeTruthy()
  })

  it('усі сховані предмети є серед варіантів, а варіанти не повторюються', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 30; i++) {
        const trial = generateTrial(level)
        const options = trial.options.map((o) => o.icon)
        expect(options).toHaveLength(level.options)
        expect(new Set(options).size).toBe(level.options)
        for (const hidden of trial.hidden) expect(options).toContain(hidden.icon)
      }
    }
  })

  it('рахує знайдені, пропущені й зайві', () => {
    const trial = { hidden: [{ icon: 'Cat' }, { icon: 'Key' }] }
    expect(checkAnswer(trial, new Set(['Cat', 'Sun']))).toEqual({
      correct: false,
      hits: 1,
      falseAlarms: 1,
      misses: 1,
    })
    expect(checkAnswer(trial, new Set(['Cat', 'Key'])).correct).toBe(true)
  })

  it('позначити все підряд — не сто балів', () => {
    expect(scoring([{ correct: false, hits: 2, falseAlarms: 3, misses: 0 }]).score).toBe(0)
  })
})
