import { describe, it, expect } from 'vitest'
import {
  CONFUSABLE,
  LETTERS,
  WORDS,
  config,
  distractorsFor,
  generateTrial,
  maskedWord,
  soundAt,
  wordsFor,
} from './firstSound.config'
import { PICTURES } from '../engine/pictures'

describe('словник', () => {
  it('кожна картинка існує', () => {
    for (const { icon } of WORDS) expect(PICTURES[icon], icon).toBeTruthy()
  })

  it('перша літера кожного слова — один звук, який можна вибрати', () => {
    for (const { word } of WORDS) expect(LETTERS, word).toContain(soundAt(word, 'first'))
  })

  it('слова на останній звук закінчуються на приголосний, а не на ь чи я', () => {
    const words = wordsFor(config.levels[2])
    expect(words.length).toBeGreaterThan(15)
    for (const { word } of words) expect('бвгджзклмнпрстфхцчш', word).toContain(soundAt(word, 'last'))
  })

  it('слова не повторюються', () => {
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length)
  })
})

describe('проба', () => {
  it('закриває саме той звук, про який питає', () => {
    expect(maskedWord('кіт', 'first')).toBe('_іт')
    expect(maskedWord('кіт', 'last')).toBe('кі_')
  })

  it('варіанти різні, і правильний серед них', () => {
    for (const level of config.levels) {
      for (let i = 0; i < 40; i++) {
        const trial = generateTrial(level)
        expect(trial.options).toHaveLength(level.options)
        expect(new Set(trial.options).size).toBe(level.options)
        expect(trial.options).toContain(trial.answer)
      }
    }
  })

  it('на рівні «схожі звуки» підставляє звуки з тієї самої групи', () => {
    const [close] = distractorsFor('с', 3, true)
    expect(CONFUSABLE[0]).toContain(close)
  })

  it('на легкому рівні схожих звуків не підставляє', () => {
    for (let i = 0; i < 30; i++) {
      for (const letter of distractorsFor('б', 2, false)) expect(['б', 'п']).not.toContain(letter)
    }
  })
})
