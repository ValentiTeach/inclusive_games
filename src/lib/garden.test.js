import { describe, it, expect } from 'vitest'
import { GARDEN_SIZE, buildGarden, slotPosition } from './garden'

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
