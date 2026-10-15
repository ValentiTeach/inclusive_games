import { describe, it, expect } from 'vitest'
import { GAMES, NEEDS, gameNeeds } from './games'
import { GAME_REGISTRY } from '../games/registry'

describe('вимоги ігор', () => {
  /*
   * «Є обмеження часу» — рівно ті ігри, де темп щось змінює, тобто ті, що
   * мають config.relaxed. Нова гра з таймером без позначки сховалася б від
   * фільтра «Потрібен свій темп» — і дитина отримала б саме те, чого треба
   * було уникнути.
   */
  it('таймер позначено рівно в іграх, де темп щось змінює', () => {
    for (const game of GAMES) {
      const config = GAME_REGISTRY[game.id]?.config
      expect(config, game.id).toBeTruthy()
      expect(gameNeeds(game.id).includes('timer'), game.id).toBe(Boolean(config.relaxed))
    }
  })

  it('кожна вимога має підпис для картки і для фільтра', () => {
    for (const need of Object.values(NEEDS)) {
      expect(need.label).toBeTruthy()
      expect(need.filter).toBeTruthy()
    }
  })

  it('ігри на слух позначені', () => {
    for (const id of ['rhythm', 'first-sound', 'listen-catch', 'ten-words']) {
      expect(gameNeeds(id), id).toContain('hearing')
    }
  })

  it('порядок позначок однаковий для всіх карток', () => {
    expect(gameNeeds('keyboard-trainer')).toEqual(['reading', 'fineMotor'])
    expect(gameNeeds('listen-catch')).toEqual(['hearing', 'timer'])
  })
})
