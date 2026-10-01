import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import GraphicDictationPlayArea from './GraphicDictationPlayArea'
import {
  MOTIFS,
  buildCommands,
  commandAt,
  config,
  flattenSteps,
  generateTrial,
  layout,
} from './graphicDictation.config'

const ARROW_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }

function press(key) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('візерунки', () => {
  it('зливає однакові сусідні команди: «1 вправо, 1 вправо» — це «2 вправо»', () => {
    const commands = buildCommands(MOTIFS.hook, 2)
    for (let i = 1; i < commands.length; i++) expect(commands[i].dir).not.toBe(commands[i - 1].dir)
    expect(flattenSteps(commands)).toHaveLength(flattenSteps(MOTIFS.hook).length * 2)
  })

  /*
   * Лінія, що йде по вже намальованому відрізку, виглядає як недомальована:
   * дитина не бачить, що крок зроблено. Тож жоден відрізок не повторюється.
   */
  it.each(Object.keys(MOTIFS))('%s не проходить двічі по одному відрізку', (name) => {
    const { points } = layout(flattenSteps(buildCommands(MOTIFS[name], 3)))
    const edges = new Set()
    for (let i = 1; i < points.length; i++) {
      const a = `${points[i - 1].x},${points[i - 1].y}`
      const b = `${points[i].x},${points[i].y}`
      const edge = [a, b].sort().join('-')
      expect(edges.has(edge)).toBe(false)
      edges.add(edge)
    }
  })

  it('сітка має поле навколо лінії', () => {
    const { points, cols, rows } = layout(flattenSteps(MOTIFS.teeth))
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(1)
      expect(p.x).toBeLessThanOrEqual(cols - 1)
      expect(p.y).toBeLessThanOrEqual(rows - 1)
    }
  })

  it('знає, яку команду виконує дитина', () => {
    const commands = [
      { dir: 'up', n: 2 },
      { dir: 'right', n: 1 },
    ]
    expect(commandAt(commands, 0)).toEqual({ index: 0, done: 0 })
    expect(commandAt(commands, 1)).toEqual({ index: 0, done: 1 })
    expect(commandAt(commands, 2)).toEqual({ index: 1, done: 0 })
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('правильні стрілки ведуть лінію, хибна — рахується помилкою', () => {
    const level = { ...config.levels[0], trialCount: 1, repeats: 1, motifs: ['teeth'] }
    const onFinish = vi.fn()
    render(<GraphicDictationPlayArea level={level} onFinish={onFinish} />)

    const steps = generateTrial(level).steps
    press('ArrowLeft') // у «зубцях» першого кроку вліво немає
    for (const dir of steps) press(ARROW_KEYS[dir])
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0].metrics).toMatchObject({
      correct: steps.length,
      errors: 1,
    })
  })
})
