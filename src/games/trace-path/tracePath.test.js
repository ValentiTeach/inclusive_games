import { describe, it, expect } from 'vitest'
import { advance, config, generateTrial, insidePct, isFinished, nearest } from './tracePath.config'

const FRESH = { progress: 0, insideMs: 0, outsideMs: 0, exits: 0, inside: true }
const level = config.levels[1]

describe('доріжки', () => {
  it('точки лягають рівномірно — без стрибків прогресу', () => {
    for (const shape of ['line', 'wave', 'double-wave', 'zigzag', 'meander', 'spiral']) {
      const { points } = generateTrial({ ...level, shapes: [shape] })
      for (let i = 1; i < points.length; i++) {
        const gap = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        // STEP (4) уздовж лінії. Навпростець відстань буває меншою лише там,
        // де крок зрізає кут зигзагу, — але не вдвічі.
        expect(gap, shape).toBeLessThanOrEqual(4.01)
        if (i < points.length - 1) expect(gap, shape).toBeGreaterThan(2)
      }
    }
  })
})

describe('ведення', () => {
  const trial = generateTrial({ ...level, shapes: ['line'] })

  it('рух по центру доріжки просуває вперед і рахується всередині', () => {
    const state = advance(FRESH, trial, { x: 80, y: 150 }, 100)
    expect(state.inside).toBe(true)
    expect(state.progress).toBeGreaterThan(0)
    expect(state.insideMs).toBe(100)
  })

  it('вихід за край рахується і не просуває', () => {
    const inside = advance(FRESH, trial, { x: 60, y: 150 }, 100)
    const outside = advance(inside, trial, { x: 90, y: 150 + level.width }, 100)
    expect(outside.inside).toBe(false)
    expect(outside.exits).toBe(1)
    expect(outside.progress).toBe(inside.progress)
    expect(insidePct(outside)).toBe(50)
  })

  it('не можна перестрибнути одразу до фінішу', () => {
    const state = advance(FRESH, trial, { x: 555, y: 150 }, 100)
    expect(isFinished(state, trial)).toBe(false)
  })

  it('шукає найближчу точку лише поблизу пройденого', () => {
    const { index } = nearest(trial.points, { x: 555, y: 150 }, 0)
    expect(index).toBeLessThanOrEqual(40)
  })

  it('доріжка пройдена, коли дійшли до кінця', () => {
    let state = FRESH
    for (let x = 40; x <= 560; x += 8) state = advance(state, trial, { x, y: 150 }, 50)
    expect(isFinished(state, trial)).toBe(true)
    expect(insidePct(state)).toBe(100)
  })
})

describe('спіраль', () => {
  it('вміщається в поле і має витки, далі один від одного, ніж ширина доріжки', () => {
    const { points } = generateTrial({ ...config.levels[2], shapes: ['spiral'] })
    for (const p of points) {
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(600)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(300)
    }
    // Дві точки, далекі одна від одної вздовж доріжки (понад 30 кроків), але
    // близькі на полі, — це сусідні витки. Між ними має вміститися доріжка.
    let closest = Infinity
    for (let i = 0; i < points.length; i += 3) {
      for (let j = i + 30; j < points.length; j += 3) {
        closest = Math.min(closest, Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y))
      }
    }
    expect(closest).toBeGreaterThan(config.levels[2].width)
  })
})
