import { describe, it, expect } from 'vitest'
import {
  GARDEN_SIZE,
  buildGarden,
  heartStage,
  loadGardenPrefs,
  saveGardenPrefs,
  seasonOf,
  slotPosition,
} from './garden'

describe('buildGarden', () => {
  it('a day of play grows grass, a finished session grows a flower', () => {
    const garden = buildGarden({
      days: ['2026-09-01', '2026-09-01', '2026-09-02'],
      sessionDates: ['2026-09-02T09:00:00Z'],
    })
    expect(garden.items.map((item) => item.kind)).toEqual(['day', 'day', 'session'])
    expect(garden.items.at(-1).plant).toBe('tulip')
  })

  it('does not depend on the score at all — it has no score input', () => {
    expect(buildGarden({ days: ['2026-09-01'] }).total).toBe(1)
  })

  it('starts a new garden when one is full, keeping the count', () => {
    const days = Array.from({ length: GARDEN_SIZE + 3 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    )
    const garden = buildGarden({ days })
    expect(garden.gardensDone).toBe(1)
    expect(garden.items).toHaveLength(3)
  })

  it('places every slot inside the picture', () => {
    for (let slot = 0; slot < GARDEN_SIZE; slot += 1) {
      const { x, y } = slotPosition(slot)
      expect(x).toBeGreaterThan(5)
      expect(x).toBeLessThan(375)
      expect(y).toBeLessThan(230)
    }
  })
})

describe('пори року, улюблена рослина, назва', () => {
  it('пора року йде за календарем', () => {
    expect(seasonOf(new Date('2026-01-10'))).toBe('winter')
    expect(seasonOf(new Date('2026-12-01'))).toBe('winter')
    expect(seasonOf(new Date('2026-04-10'))).toBe('spring')
    expect(seasonOf(new Date('2026-07-10'))).toBe('summer')
    expect(seasonOf(new Date('2026-10-15'))).toBe('autumn')
  })

  // Серце саду лише росте: стадія залежить від кількості рослин, а не від балу.
  it('улюблена рослина росте разом із садом і не меншає', () => {
    expect(heartStage(0)).toBe('sprout')
    expect(heartStage(6)).toBe('bud')
    expect(heartStage(16)).toBe('bloom')
    expect(heartStage(200)).toBe('bloom')
  })

  // Друга дитина за тим самим комп'ютером не отримує чужої назви.
  it('назва й рослина — окремо для кожного власника історії', () => {
    localStorage.clear()
    saveGardenPrefs('child-a', { name: '  Чарівний сад  ', favorite: 'sunflower' })
    expect(loadGardenPrefs('child-a')).toEqual({ name: 'Чарівний сад', favorite: 'sunflower' })
    expect(loadGardenPrefs('child-b')).toEqual({ name: '', favorite: null })
  })

  it('невідому рослину зі сховища не бере', () => {
    localStorage.setItem('inclusive-games:garden:x', JSON.stringify({ name: 'А', favorite: 'cactus' }))
    expect(loadGardenPrefs('x').favorite).toBeNull()
  })
})
