import { describe, it, expect } from 'vitest'
import { STORIES, checkAnswer, config, correctOrder, generateTrial, storiesFor, storyText } from './storyOrder.config'
import { PICTURES } from '../engine/pictures'

describe('історії', () => {
  it('кожна картинка існує', () => {
    for (const story of STORIES) for (const [icon] of story.steps) expect(PICTURES[icon], icon).toBeTruthy()
  })

  it('на кожен рівень є щонайменше дві історії', () => {
    for (const level of config.levels) expect(storiesFor(level).length).toBeGreaterThanOrEqual(2)
  })

  it('картинок стільки, скільки кроків рівня, і правильний порядок — порядок історії', () => {
    for (const level of config.levels) {
      const trial = generateTrial(level)
      expect(trial.items).toHaveLength(level.steps)
      expect(checkAnswer(trial, correctOrder(trial)).correct).toBe(true)
    }
  })

  it('складає історію одним реченням', () => {
    const trial = { steps: [{ label: 'пішов дощ' }, { label: 'вийшла веселка' }] }
    expect(storyText(trial)).toBe('Пішов дощ, потім вийшла веселка.')
  })
})
