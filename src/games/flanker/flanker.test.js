import { describe, it, expect } from 'vitest'
import { config, conflictEffect, generateTrial } from './flanker.config'

describe('зграйки', () => {
  it('середня рибка завжди пливе туди, куди треба відповісти', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 40; i++) {
        const trial = generateTrial(level)
        expect(trial.fish).toHaveLength(level.flankers * 2 + 1)
        expect(trial.fish[level.flankers]).toBe(trial.target)
        const sides = trial.fish.filter((_, index) => index !== level.flankers)
        expect(sides.every((d) => d === (trial.congruent ? trial.target : sides[0]))).toBe(true)
        if (!trial.congruent) expect(sides[0]).not.toBe(trial.target)
      }
    }
  })

  it('обидва типи проб трапляються', () => {
    const kinds = new Set(Array.from({ length: 100 }, () => generateTrial(config.levels[0]).congruent))
    expect(kinds).toEqual(new Set([true, false]))
  })
})

describe('ефект конфлікту', () => {
  it('— різниця часу правильних відповідей: конфлікт мінус згода', () => {
    expect(
      conflictEffect([
        { correct: true, congruent: true, reactionTimeMs: 500 },
        { correct: true, congruent: false, reactionTimeMs: 650 },
        { correct: false, congruent: false, reactionTimeMs: 300 },
      ]),
    ).toBe(150)
  })

  it('без правильних відповідей одного з типів не рахується', () => {
    expect(conflictEffect([{ correct: true, congruent: true, reactionTimeMs: 500 }])).toBeUndefined()
  })
})
