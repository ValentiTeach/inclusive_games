import { describe, it, expect } from 'vitest'
import { CAPACITY, canMove, distancesFrom, generateProblem, move, stateKey } from './tower.config'

const START = [['red', 'green', 'blue'], [], []]

describe('правила', () => {
  it('на стрижень не покласти більше, ніж він вміщує', () => {
    const pegs = [['red'], ['green'], ['blue']]
    expect(canMove(pegs, 0, 2)).toBe(false)
    expect(canMove(pegs, 0, 1)).toBe(true)
  })

  it('з порожнього стрижня брати нічого', () => {
    expect(canMove(START, 1, 2)).toBe(false)
  })

  it('бере лише верхню кульку', () => {
    expect(move(START, 0, 2)).toEqual([['red', 'green'], [], ['blue']])
  })
})

describe('задачі', () => {
  it('усіх розкладок — 36, і з будь-якої можна дійти до будь-якої', () => {
    const all = distancesFrom(START)
    expect(all.size).toBe(36)
    for (const { pegs } of all.values()) {
      for (let i = 0; i < 3; i++) expect(pegs[i].length).toBeLessThanOrEqual(CAPACITY[i])
    }
  })

  it.each([1, 2, 3, 4, 5])('задача на %i ходів справді потребує рівно стільки', (moves) => {
    for (let i = 0; i < 10; i++) {
      const problem = generateProblem(moves)
      const distance = distancesFrom(problem.start).get(stateKey(problem.goal)).distance
      expect(distance).toBe(moves)
    }
  })
})
