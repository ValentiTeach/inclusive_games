import { describe, it, expect } from 'vitest'
import { GROUPS, config, generateTrial, pickGroups } from './wordGroups.config'
import { PICTURES } from '../engine/pictures'

describe('групи', () => {
  it('кожна картинка існує', () => {
    for (const group of GROUPS) {
      expect(PICTURES[group.icon], group.icon).toBeTruthy()
      for (const [icon] of group.items) expect(PICTURES[icon], icon).toBeTruthy()
    }
  })

  it('жоден предмет не належить двом групам одразу', () => {
    const words = GROUPS.flatMap((group) => group.items.map(([, word]) => word))
    expect(new Set(words).size).toBe(words.length)
  })
})

describe('проби', () => {
  it('предмет завжди з однієї з груп гри', () => {
    const level = config.levels[1]
    const groups = pickGroups(level)
    expect(groups).toHaveLength(3)
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(level, groups)
      expect(groups.map((g) => g.id)).toContain(trial.answer)
      expect(trial.item.groupId).toBe(trial.answer)
    }
  })

  it('у «четвертому зайвому» рівно один предмет з іншої групи', () => {
    const level = config.levels[2]
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(level, pickGroups(level))
      const counts = {}
      for (const item of trial.items) counts[item.groupId] = (counts[item.groupId] ?? 0) + 1
      expect(Object.values(counts).sort()).toEqual([1, 3])
      expect(trial.items.find((item) => item.word === trial.answer).groupId).toBe(trial.oddGroup.id)
    }
  })
})
