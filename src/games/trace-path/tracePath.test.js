import { describe, it, expect } from 'vitest'
import { advance, config, generateTrial, insidePct, isFinished, nearest } from './tracePath.config'

const FRESH = { progress: 0, insideMs: 0, outsideMs: 0, exits: 0, inside: true }
const level = config.levels[1]

describe('доріжки', () => {
  it('точки лягають рівномірно — без стрибків прогресу', () => {
    for (const shape of ['line', 'wave', 'double-wave', 'zigzag', 'meander']) {
      const { points } = generateTrial({ ...level, shapes: [shape] })
      for (let i = 1; i < points.length; i++) {
        const gap = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        expect(gap, shape).toBeLessThan(6)
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
