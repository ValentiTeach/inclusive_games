import { describe, it, expect } from 'vitest'
import {
  isRelaxed,
  paceChangesGame,
  paceLevel,
  paceNote,
  paceResult,
  practiceHint,
  practiceLevel,
  slower,
} from './adapt'
import { GAME_REGISTRY } from '../registry'

const CONFIGS = Object.values(GAME_REGISTRY).map(({ config }) => config)

describe('пробна гра', () => {
  it('скорочує гру з проб до трьох проб', () => {
    const level = practiceLevel({}, { id: 'x', trialCount: 20 })
    expect(level.trialCount).toBe(3)
    expect(level.practice).toBe(true)
  })

  it('скорочує гру з раундів', () => {
    expect(practiceLevel({}, { id: 'x', rounds: 12 }).rounds).toBe(3)
  })

  it('не подовжує рівень, коротший за пробу', () => {
    expect(practiceLevel({}, { id: 'x', trialCount: 2 }).trialCount).toBe(2)
  })

  it('бере власну пробну версію гри, якщо вона описана', () => {
    const config = { practice: { level: (level) => ({ ...level, size: 3 }) } }
    expect(practiceLevel(config, { id: 'x', size: 6 })).toEqual({ id: 'x', size: 3, practice: true })
  })

  it('підказка може залежати від рівня', () => {
    const config = { practice: { hint: (level) => `N = ${level.n}` } }
    expect(practiceHint(config, { n: 2 })).toBe('N = 2')
  })

  /*
   * Кожна гра, кожен рівень: пробна версія існує, має підказку і не довша за
   * справжню. Інакше «коротка пробна гра» могла б виявитися довшою за залік.
   */
  describe.each(CONFIGS.map((config) => [config.id, config]))('%s', (_id, config) => {
    it.each(config.levels.map((level) => [level.id, level]))('рівень %s', (_levelId, level) => {
      const hint = practiceHint(config, level)
      expect(typeof hint).toBe('string')
      expect(hint.length).toBeGreaterThan(10)

      const short = practiceLevel(config, level)
      expect(short.practice).toBe(true)
      for (const key of ['trialCount', 'rounds', 'size', 'pairs', 'targetLength', 'maxLength']) {
        if (Number.isFinite(level[key])) expect(short[key]).toBeLessThanOrEqual(level[key])
      }
      // Хоч щось має стати коротшим — інакше це не проба, а та сама гра.
      const shorter = ['trialCount', 'rounds', 'size', 'pairs', 'targetLength', 'maxLength'].some(
        (key) => Number.isFinite(level[key]) && short[key] < level[key],
      )
      expect(shorter).toBe(true)
    })
  })
})

describe('без поспіху', () => {
  const timed = {
    relaxed: { note: 'довше', level: (level) => ({ ...level, windowMs: slower(level.windowMs, 2) }) },
  }

  it('на звичайному темпі рівень не змінюється — той самий об’єкт', () => {
    const level = { id: 'x', windowMs: 800 }
    expect(paceLevel(timed, level, 'normal')).toBe(level)
  })

  it('без поспіху подовжує час і позначає рівень', () => {
    expect(paceLevel(timed, { id: 'x', windowMs: 800 }, 'relaxed')).toEqual({
      id: 'x',
      windowMs: 1600,
      relaxed: true,
    })
  })

  it('гру без обмеження часу не чіпає і не позначає', () => {
    const level = { id: 'x', trialCount: 10 }
    expect(paceLevel({}, level, 'relaxed')).toBe(level)
    expect(isRelaxed({}, 'relaxed')).toBe(false)
  })

  it('пояснює, що в грі й так немає обмеження часу', () => {
    expect(paceNote({})).toMatch(/немає обмеження часу/)
  })

  const result = {
    score: 40,
    entries: [{ label: 'Час', value: '60 с' }],
    metrics: { errors: 1, duration_ms: 60000 },
  }

  it('позначає спробу і для вчителя, і для бази', () => {
    const paced = paceResult(timed, result, 'relaxed')
    expect(paced.metrics.relaxed_pace).toBe(true)
    expect(paced.entries.at(-1)).toEqual({ label: 'Темп', value: 'Без поспіху' })
    expect(paced.score).toBe(40)
  })

  it('на звичайному темпі результат той самий', () => {
    expect(paceResult(timed, result, 'normal')).toBe(result)
  })

  it('не позначає спробу в грі, яку темп не змінює', () => {
    expect(paceResult({ relaxed: { note: 'без змін' } }, result, 'relaxed')).toBe(result)
  })

  it('Шульте без поспіху рахує бал лише за помилками', () => {
    const { config } = GAME_REGISTRY.schulte
    const paced = paceResult(config, result, 'relaxed')
    expect(paced.score).toBe(92)
  })

  it('Світлофор без поспіху рахує бал за точністю, а не швидкістю', () => {
    const { config } = GAME_REGISTRY['traffic-light']
    const slow = { score: 10, entries: [], metrics: { accuracy_pct: 90, avg_rt_ms: 1300 } }
    expect(paceResult(config, slow, 'relaxed').score).toBe(90)
  })

  it('Швидкість реакції темп не змінює — вона і є вимірюванням швидкості', () => {
    const { config } = GAME_REGISTRY['reaction-time']
    expect(paceChangesGame(config)).toBe(false)
    expect(paceNote(config)).toMatch(/швидкість/)
  })

  /*
   * «Без поспіху» лише дає більше часу. Жоден час показу чи вікно відповіді не
   * має стати коротшим, а решта рівня — змінитися.
   */
  describe.each(CONFIGS.filter(paceChangesGame).map((config) => [config.id, config]))(
    '%s',
    (_id, config) => {
      it.each(config.levels.map((level) => [level.id, level]))('рівень %s', (_levelId, level) => {
        const paced = paceLevel(config, level, 'relaxed')
        expect(paced.relaxed).toBe(true)
        for (const [key, value] of Object.entries(level)) {
          if (key.endsWith('Ms')) expect(paced[key]).toBeGreaterThanOrEqual(value)
          else expect(paced[key]).toEqual(value)
        }
        expect(paceNote(config)).not.toMatch(/немає обмеження/)
      })
    },
  )
})
