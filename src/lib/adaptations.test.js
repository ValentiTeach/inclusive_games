import { describe, it, expect, beforeEach } from 'vitest'
import {
  ADAPTATIONS,
  EMPTY_PROFILE,
  activeAdaptations,
  bindAdaptationsOwner,
  clearActiveAdaptations,
  getActiveAdaptations,
  normalizeAdaptations,
  setActiveAdaptations,
} from './adaptations'
import { gameColor, safeColorFor } from './palette'

describe('normalizeAdaptations', () => {
  it('drops unknown keys and keeps only real booleans', () => {
    const profile = normalizeAdaptations({ noTimeLimit: 'true', sensorySafe: true, diagnosis: 'РАС' })
    expect(profile.noTimeLimit).toBe(false)
    expect(profile.sensorySafe).toBe(true)
    expect('diagnosis' in profile).toBe(false)
  })

  it('clamps numbers into the range the specialist could pick', () => {
    const profile = normalizeAdaptations({ holdMs: 50000, repeatGuardMs: 10, shortTrials: 3, scanMs: -1 })
    expect(profile.holdMs).toBe(800)
    expect(profile.repeatGuardMs).toBe(200)
    expect(profile.shortTrials).toBe(5)
    expect(profile.scanMs).toBe(0)
  })

  it('survives garbage', () => {
    expect(normalizeAdaptations(null)).toEqual(EMPTY_PROFILE)
    expect(normalizeAdaptations('x')).toEqual(EMPTY_PROFILE)
  })

  it('every adaptation in the form maps to a profile key', () => {
    for (const item of ADAPTATIONS) expect(item.id in EMPTY_PROFILE).toBe(true)
  })

  it('lists what is switched on', () => {
    const ids = activeAdaptations({ ...EMPTY_PROFILE, holdMs: 500, colorSafe: true }).map((item) => item.id)
    expect(ids).toEqual(['holdMs', 'colorSafe'])
  })
})

describe('active profile on a shared computer', () => {
  beforeEach(() => clearActiveAdaptations())

  it('applies the cached profile only to its owner', () => {
    setActiveAdaptations('kid-a', { dyslexiaFont: true })
    expect(document.documentElement.dataset.dyslexiaFont).toBe('on')

    // Наступна дитина за тим самим комп'ютером — не отримує чужого шрифту.
    bindAdaptationsOwner('kid-b')
    expect(getActiveAdaptations().dyslexiaFont).toBe(false)
    expect(document.documentElement.dataset.dyslexiaFont).toBeUndefined()

    // А чужа копія зникла зовсім: kid-a повернеться — профіль прийде з хмари.
    bindAdaptationsOwner('kid-a')
    expect(getActiveAdaptations().dyslexiaFont).toBe(false)
  })

  it('restores the owner’s own profile without network', () => {
    setActiveAdaptations('kid-a', { largeTargets: true })
    bindAdaptationsOwner('kid-a')
    expect(getActiveAdaptations().largeTargets).toBe(true)
  })
})

describe('colour-safe palette', () => {
  beforeEach(() => clearActiveAdaptations())

  it('replaces the red–green pair, leaves unknown colours alone', () => {
    expect(safeColorFor('#c0392b')).not.toBe('#c0392b')
    expect(safeColorFor('#2e8b57')).not.toBe('#2e8b57')
    expect(safeColorFor('#C0392B')).toBe(safeColorFor('#c0392b'))
    expect(safeColorFor('#ffffff')).toBe('#ffffff')
  })

  it('only when the profile asks for it', () => {
    expect(gameColor('#c0392b')).toBe('#c0392b')
    setActiveAdaptations('kid', { colorSafe: true })
    expect(gameColor('#c0392b')).toBe(safeColorFor('#c0392b'))
  })
})
