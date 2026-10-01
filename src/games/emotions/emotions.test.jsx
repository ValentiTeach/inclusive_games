import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EMOTIONS, PEOPLE, SITUATIONS, config, generateTrial, optionEmotion } from './emotions.config'
import Face from './Face'

describe('проби', () => {
  it.each(config.levels.map((level) => [level.id, level]))('%s: правильна відповідь серед варіантів рівно раз', (_id, level) => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(level)
      const emotions = trial.options.map(optionEmotion)
      expect(emotions.filter((e) => e === trial.answer)).toHaveLength(1)
      expect(new Set(emotions).size).toBe(emotions.length)
    }
  })

  it('«таке саме обличчя» шукається серед інших людей, не серед копій', () => {
    for (let i = 0; i < 40; i++) {
      const trial = generateTrial(config.levels[0])
      for (const option of trial.options) expect(option.person.id).not.toBe(trial.person.id)
    }
  })

  it('для кожної емоції є бодай одна ситуація', () => {
    for (const emotion of Object.keys(EMOTIONS)) {
      expect(SITUATIONS.some((s) => s.emotion === emotion), emotion).toBe(true)
    }
  })
})

describe('обличчя', () => {
  it('малюється для кожної емоції і кожної людини', () => {
    for (const emotion of Object.keys(EMOTIONS)) {
      for (const person of PEOPLE) {
        const { container, unmount } = render(<Face emotion={emotion} person={person} />)
        expect(container.querySelector('svg')).toBeTruthy()
        unmount()
      }
    }
  })
})
