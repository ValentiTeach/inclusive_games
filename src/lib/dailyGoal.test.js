import { describe, it, expect } from 'vitest'
import { dailyGoal, dailyGoalText, DAILY_TARGET } from './dailyGoal'

describe('щоденна мета', () => {
  it('рахує, скільки лишилось', () => {
    expect(dailyGoal(1)).toMatchObject({ done: 1, left: DAILY_TARGET - 1, reached: false })
  })

  it('виконана мета не лишає боргу', () => {
    expect(dailyGoal(DAILY_TARGET)).toMatchObject({ left: 0, reached: true })
  })

  /**
   * Дитина, яка зіграла більше за мету, не має бачити «лишилось -2» або смужку,
   * що вилізла за край.
   */
  it('перевиконання не дає ні від’ємного залишку, ні переповненої смужки', () => {
    const goal = dailyGoal(DAILY_TARGET + 5)

    expect(goal.left).toBe(0)
    expect(goal.percent).toBe(100)
    expect(goal.reached).toBe(true)
  })

  it('порожній день — це нуль, а не порожнеча', () => {
    expect(dailyGoal(0)).toMatchObject({ done: 0, percent: 0, reached: false })
  })
})

describe('текст мети', () => {
  /**
   * Дитина, яка зайшла й побачила докір, наступного разу може не зайти. Тому
   * жоден із текстів не має говорити про провал.
   */
  it('жоден текст не дорікає', () => {
    const texts = [0, 1, 2, 3, 9].map((done) => dailyGoalText(dailyGoal(done)))

    for (const text of texts) {
      expect(text).not.toMatch(/не встиг|провал|погано|мало|failed/i)
    }
  })

  it('порожній день кличе почати, а не соромить', () => {
    expect(dailyGoalText(dailyGoal(0))).toMatch(/Зіграй/)
  })

  it('одна гра до мети — в однині', () => {
    expect(dailyGoalText(dailyGoal(DAILY_TARGET - 1))).toBe('Лишилась одна гра.')
  })

  it('виконана мета не вимагає грати далі', () => {
    expect(dailyGoalText(dailyGoal(DAILY_TARGET))).toMatch(/просто так/)
  })
})
