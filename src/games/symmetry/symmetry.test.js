import { describe, it, expect } from 'vitest'
import { checkAnswer, config, generateTrial, key } from './symmetry.config'

describe('симетрія', () => {
  it('у візерунку стільки клітинок, скільки вимагає рівень, і всі в межах половини', () => {
    for (const level of config.levels) {
      const { pattern } = generateTrial(level)
      expect(pattern.size).toBe(level.filled)
      for (const cell of pattern) {
        const [row, col] = cell.split(':').map(Number)
        expect(row).toBeLessThan(level.rows)
        expect(col).toBeLessThan(level.cols)
      }
    }
  })

  it('дзеркало — ті самі відстані від лінії', () => {
    const trial = { pattern: new Set([key(0, 0), key(1, 2)]) }
    expect(checkAnswer(trial, new Set([key(0, 0), key(1, 2)])).correct).toBe(true)
    // Скопійовано, а не віддзеркалено: клітинка біля краю замість біля лінії.
    expect(checkAnswer(trial, new Set([key(0, 2), key(1, 0)]))).toMatchObject({
      correct: false,
      hits: 0,
      extra: 2,
      missed: 2,
    })
  })
})
