import { describe, it, expect } from 'vitest'
import { LISTS, checkAnswer, config, generateSequence } from './listenCatch.config'

describe('списки слів', () => {
  it('жодне слово не є водночас потрібним і зайвим', () => {
    for (const list of Object.values(LISTS)) {
      for (const word of list.targets) expect(list.others).not.toContain(word)
    }
  })

  it('на рівні «звук м» потрібні слова починаються з «м», а зайві — ні', () => {
    for (const word of LISTS.sound.targets) expect(word[0]).toBe('м')
    for (const word of LISTS.sound.others) expect(word[0]).not.toBe('м')
  })

  it('послідовність має і потрібні, і зайві слова', () => {
    for (const level of config.levels) {
      const kinds = new Set()
      for (let i = 0; i < 10; i++) generateSequence(level).forEach((trial) => kinds.add(trial.isTarget))
      expect(kinds).toEqual(new Set([true, false]))
    }
  })
})

describe('відповіді', () => {
  it('як у Go/No-Go: влучання, пропуск, хибне натискання, стримання', () => {
    expect(checkAnswer({ isTarget: true }, true).outcome).toBe('hit')
    expect(checkAnswer({ isTarget: true }, false).outcome).toBe('miss')
    expect(checkAnswer({ isTarget: false }, true).outcome).toBe('false-alarm')
    expect(checkAnswer({ isTarget: false }, false).outcome).toBe('correct-reject')
  })
})
