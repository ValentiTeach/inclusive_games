import { describe, it, expect } from 'vitest'
import {
  ASPECT,
  LETTERS,
  buildSequence,
  checkTap,
  config,
  generateTrial,
  isConnected,
  placeNodes,
  scoring,
} from './trail.config'

const [numbers, shapes, letters] = config.levels

function byId(trial, id) {
  return trial.nodes.find((node) => node.id === id)
}

describe('ланцюжок', () => {
  it('числа — просто 1, 2, 3… без пасток', () => {
    const { path, decoys } = buildSequence(numbers)
    expect(path.map((node) => node.label)).toEqual(
      Array.from({ length: numbers.size }, (_, i) => String(i + 1)),
    )
    expect(decoys).toHaveLength(0)
  })

  it('число — літера чергуються, і абетка йде з Ґ на своєму місці', () => {
    const { path } = buildSequence({ ...letters, size: 12 })
    expect(path.map((node) => node.label)).toEqual(['1', 'А', '2', 'Б', '3', 'В', '4', 'Г', '5', 'Ґ', '6', 'Д'])
    expect(LETTERS.indexOf('Ґ')).toBe(LETTERS.indexOf('Г') + 1)
  })

  it('коло — квадрат: кожне число двічі, ланцюжок чергує форму', () => {
    const { path, decoys } = buildSequence(shapes)
    expect(path.map((node) => node.shape)).toEqual(
      Array.from({ length: shapes.size }, (_, i) => (i % 2 === 0 ? 'circle' : 'square')),
    )
    expect(decoys).toHaveLength(shapes.size)
    for (const [index, node] of path.entries()) {
      expect(decoys[index].label).toBe(node.label)
      expect(decoys[index].shape).not.toBe(node.shape)
    }
  })

  it('ідентифікатори кружечків не повторюються', () => {
    for (const level of config.levels) {
      const { path, decoys } = buildSequence(level)
      const ids = [...path, ...decoys].map((node) => node.id)
      expect(new Set(ids).size, level.id).toBe(ids.length)
    }
  })
})

describe('поле', () => {
  it('кружечки не налазять один на одного і не виходять за край', () => {
    for (const level of config.levels) {
      for (let run = 0; run < 20; run++) {
        const { nodes } = generateTrial(level)
        for (const node of nodes) {
          expect(node.x).toBeGreaterThanOrEqual(5)
          expect(node.x).toBeLessThanOrEqual(95)
          expect(node.y).toBeGreaterThanOrEqual(7)
          expect(node.y).toBeLessThanOrEqual(93)
        }
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const gap = Math.hypot((nodes[i].x - nodes[j].x) * ASPECT, nodes[i].y - nodes[j].y)
            // Кружечок — 9% ширини, тобто 12 одиниць висоти.
            expect(gap, level.id).toBeGreaterThanOrEqual(12)
          }
        }
      }
    }
  })

  it('навіть коли випадковість не допомагає, повертає рівно стільки точок', () => {
    expect(placeNodes(20, () => 0.5)).toHaveLength(20)
  })
})

describe('дотики', () => {
  it('правильний — лише наступний у ланцюжку', () => {
    const trial = generateTrial(letters)
    expect(checkTap(trial, 0, byId(trial, 'n1')).correct).toBe(true)
    expect(checkTap(trial, 1, byId(trial, 'lА')).correct).toBe(true)
    expect(checkTap(trial, 1, byId(trial, 'n2')).correct).toBe(false)
  })

  it('2 замість Б — це «не перемкнувся», а В замість Б — ні', () => {
    const trial = generateTrial(letters)
    // Після 1, А, 2 чекаємо Б.
    expect(checkTap(trial, 3, byId(trial, 'n3'))).toEqual({ correct: false, perseveration: true })
    expect(checkTap(trial, 3, byId(trial, 'lВ'))).toEqual({ correct: false, perseveration: false })
  })

  it('квадрат після квадрата — «не перемкнувся»', () => {
    const trial = generateTrial(shapes)
    // Після 1 у колі і 2 у квадраті чекаємо 3 у колі; 3 у квадраті — пастка.
    expect(checkTap(trial, 2, byId(trial, 'square3'))).toEqual({ correct: false, perseveration: true })
  })

  it('на рівні з числами «не перемкнувся» не буває', () => {
    const trial = generateTrial(numbers)
    expect(checkTap(trial, 2, byId(trial, 'n5')).perseveration).toBe(false)
  })

  it('з’єднані кружечки впізнаються', () => {
    const trial = generateTrial(numbers)
    expect(isConnected(trial, 3, 'n2')).toBe(true)
    expect(isConnected(trial, 3, 'n4')).toBe(false)
  })
})

describe('бал', () => {
  it('без помилок і вчасно — 100', () => {
    expect(scoring({ elapsedMs: 10_000, errors: 0, perseverations: 0, level: numbers }).score).toBe(100)
  })

  it('«не перемкнувся» пишеться лише там, де треба перемикатися', () => {
    expect(scoring({ elapsedMs: 10_000, errors: 1, perseverations: 0, level: numbers }).metrics).not.toHaveProperty(
      'perseverations',
    )
    expect(scoring({ elapsedMs: 10_000, errors: 1, perseverations: 1, level: letters }).metrics.perseverations).toBe(1)
  })

  it('без поспіху бал — лише за помилками', () => {
    const result = scoring({ elapsedMs: 300_000, errors: 2, perseverations: 1, level: letters })
    expect(result.score).toBe(0)
    expect(config.relaxed.rescore(result).score).toBe(84)
  })
})
