import { describe, it, expect } from 'vitest'
import { DIRS, canMove, generateMaze, shortestPath, step } from './maze.config'

describe('лабіринт', () => {
  it.each([4, 5, 7, 9])('%i × %i: вихід досяжний, зовнішні стіни цілі', (size) => {
    const maze = generateMaze(size)
    expect(Number.isFinite(shortestPath(maze))).toBe(true)
    for (let i = 0; i < size; i++) {
      expect(maze.cells[i].n).toBe(true)
      expect(maze.cells[i * size].w).toBe(true)
      expect(maze.cells[i * size + size - 1].e).toBe(true)
      expect(maze.cells[(size - 1) * size + i].s).toBe(true)
    }
  })

  it('досконалий: до кожної клітинки є шлях, а проходів рівно на один менше, ніж клітинок', () => {
    const maze = generateMaze(7)
    let passages = 0
    for (let cell = 0; cell < 49; cell++) {
      expect(Number.isFinite(shortestPath(maze, 0, cell))).toBe(true)
      if (!maze.cells[cell].e) passages += 1
      if (!maze.cells[cell].s) passages += 1
    }
    expect(passages).toBe(48)
  })

  it('стіна між клітинками однакова з обох боків', () => {
    const maze = generateMaze(6)
    for (let cell = 0; cell < 36; cell++) {
      for (const name of ['right', 'down']) {
        if ((name === 'right' && cell % 6 === 5) || (name === 'down' && cell >= 30)) continue
        const next = step(maze, cell, name)
        expect(canMove(maze, cell, name)).toBe(!maze.cells[next][DIRS[name].opposite])
      }
    }
  })
})
