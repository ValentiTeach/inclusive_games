import { describe, it, expect } from 'vitest'
import { categoryFromParams, countByCategory, filterByCategory } from './catalogFilter'
import { CATEGORIES, GAMES } from '../data/games'

const params = (search) => new URLSearchParams(search)

describe('categoryFromParams', () => {
  it('читає навик з адреси', () => {
    expect(categoryFromParams(params('?category=memory'))).toBe('memory')
  })

  it('без параметра — без фільтра', () => {
    expect(categoryFromParams(params(''))).toBeNull()
  })

  /**
   * Адресу можна отримати з чужого повідомлення, зі старої закладки або
   * набрати руками. Невідомий навик має показати весь каталог, а не порожню
   * сторінку без пояснень.
   */
  it('невідомий навик не ламає каталог', () => {
    expect(categoryFromParams(params('?category=вигаданий'))).toBeNull()
    expect(categoryFromParams(params('?category='))).toBeNull()
  })

  // Object.hasOwn, а не value in CATEGORIES: інакше ?category=toString
  // пройшов би як справжній навик через прототип.
  it('не приймає властивості прототипа за навик', () => {
    expect(categoryFromParams(params('?category=toString'))).toBeNull()
    expect(categoryFromParams(params('?category=constructor'))).toBeNull()
  })
})

describe('filterByCategory', () => {
  it('без навику віддає весь список', () => {
    expect(filterByCategory(GAMES, null)).toHaveLength(GAMES.length)
  })

  it('лишає тільки ігри цього навику', () => {
    const memory = filterByCategory(GAMES, 'memory')

    expect(memory.length).toBeGreaterThan(0)
    expect(memory.every((game) => game.category === 'memory')).toBe(true)
  })
})

describe('countByCategory', () => {
  /**
   * Цифра у фільтрі — обіцянка: скільки ігор відкриється після натискання.
   * Якщо сума не дорівнює каталогу, якась гра має навик, якого немає в
   * словнику, і вона не покажеться в жодному фільтрі.
   */
  it('покриває весь каталог без залишку', () => {
    const counts = countByCategory(GAMES)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    expect(total).toBe(GAMES.length)
  })

  it('має рядок для кожного навику, навіть порожній', () => {
    const counts = countByCategory([])

    expect(Object.keys(counts).sort()).toEqual(Object.keys(CATEGORIES).sort())
    expect(Object.values(counts).every((value) => value === 0)).toBe(true)
  })

  it('рахунок збігається з тим, що справді відфільтрується', () => {
    const counts = countByCategory(GAMES)

    for (const key of Object.keys(CATEGORIES)) {
      expect(filterByCategory(GAMES, key)).toHaveLength(counts[key])
    }
  })
})
