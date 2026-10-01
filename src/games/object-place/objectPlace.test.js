import { describe, it, expect } from 'vitest'
import { ITEMS, config, generateTrial } from './objectPlace.config'
import { PICTURES } from '../engine/pictures'

describe('полиця', () => {
  it('кожна картинка існує', () => {
    for (const [icon] of ITEMS) expect(PICTURES[icon], icon).toBeTruthy()
  })

  it('кожна річ — у своїй клітинці в межах полиці, і про кожну спитають рівно раз', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 30; i++) {
        const { items, askOrder } = generateTrial(level)
        expect(items).toHaveLength(level.items)
        expect(new Set(items.map((item) => item.cell)).size).toBe(level.items)
        for (const item of items) expect(item.cell).toBeLessThan(level.size * level.size)
        expect([...askOrder].sort()).toEqual(items.map((item) => item.icon).sort())
      }
    }
  })
})
