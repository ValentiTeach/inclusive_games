import { describe, it, expect } from 'vitest'
import { suggestLevel } from './suggestLevel'
import { clampScore } from './score'

const config = {
  levels: [{ id: 'easy' }, { id: 'normal' }, { id: 'hard' }],
}

describe('suggestLevel', () => {
  it('starts a new player on the first level without calling it a suggestion', () => {
    expect(suggestLevel(config, [])).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })

  it('raises the level after a strong result', () => {
    const history = [{ levelId: 'easy', score: 90 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('lowers the level after a weak result', () => {
    const history = [{ levelId: 'hard', score: 30 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('keeps the level for a middling result', () => {
    const history = [{ levelId: 'normal', score: 60 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: false })
  })

  it('does not raise past the hardest level', () => {
    const history = [{ levelId: 'hard', score: 100 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'hard', isAutoSuggested: false })
  })

  it('does not lower below the easiest level', () => {
    const history = [{ levelId: 'easy', score: 0 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })

  it('reads only the most recent attempt', () => {
    // history[0] is the latest; older weak scores must not drag the level down.
    const history = [
      { levelId: 'easy', score: 90 },
      { levelId: 'easy', score: 10 },
      { levelId: 'easy', score: 5 },
    ]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('falls back to the first level when the stored level no longer exists', () => {
    // Levels can be renamed between releases while old history still refers to
    // the previous id.
    const history = [{ levelId: 'removed-level', score: 60 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })
})

describe('clampScore', () => {
  it('keeps scores inside 0..100', () => {
    expect(clampScore(-20)).toBe(0)
    expect(clampScore(150)).toBe(100)
    expect(clampScore(50)).toBe(50)
  })

  it('rounds fractional scores', () => {
    expect(clampScore(66.6)).toBe(67)
    expect(clampScore(66.4)).toBe(66)
  })
})
