import { describe, it, expect } from 'vitest'
import { checkRound, config, generateSet, scoring } from './tenWords.config'

describe('десять слів', () => {
  it('зайвих слів стільки ж, скільки потрібних, і вони не перетинаються', () => {
    for (const level of config.levels) {
      const set = generateSet(level)
      expect(set.targets).toHaveLength(level.words)
      expect(set.decoys).toHaveLength(level.words)
      const targets = new Set(set.targets.map((w) => w.word))
      for (const decoy of set.decoys) expect(targets.has(decoy.word)).toBe(false)
    }
  })

  it('рахує знайдені й зайві', () => {
    const set = { targets: [{ word: 'кіт' }, { word: 'риба' }] }
    expect(checkRound(set, new Set(['кіт', 'сонце']))).toEqual({ hits: 1, falseAlarms: 1 })
  })

  it('зберігає криву: першу спробу і найкращу', () => {
    const { metrics, entries } = scoring(
      [
        { hits: 3, falseAlarms: 0 },
        { hits: 5, falseAlarms: 1 },
        { hits: 4, falseAlarms: 0 },
      ],
      6,
    )
    expect(metrics).toMatchObject({ first_recall: 3, best_recall: 5, rounds_completed: 3, correct: 12, total: 18 })
    expect(entries[0].value).toBe('3 → 5 → 4')
  })
})
