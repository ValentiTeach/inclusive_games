import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSettings, saveSettings, applySettings, resolveTheme } from './settings'

const KEY = 'inclusive-games:settings'

function mockPrefersDark(matches) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('resolveTheme', () => {
  it('follows the system when set to "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('overrides the system when an explicit theme is chosen', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('falls back to the system for an unknown stored value', () => {
    // Older builds saved no theme at all, and a hand-edited value is possible.
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme('solarized', false)).toBe('light')
  })
})

describe('getSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults the theme to "system"', () => {
    expect(getSettings().theme).toBe('system')
  })

  it('keeps existing settings saved before the theme option existed', () => {
    localStorage.setItem(KEY, JSON.stringify({ soundEnabled: false, textSize: 'large' }))
    const settings = getSettings()

    expect(settings.soundEnabled).toBe(false)
    expect(settings.textSize).toBe('large')
    expect(settings.theme).toBe('system')
  })

  it('survives unparsable storage instead of throwing', () => {
    localStorage.setItem(KEY, 'not json')
    expect(getSettings().theme).toBe('system')
  })
})

describe('applySettings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('paints dark when the system is dark and the setting is "system"', () => {
    mockPrefersDark(true)
    applySettings({ ...getSettings(), theme: 'system' })

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('paints light on a dark system when light is chosen explicitly', () => {
    mockPrefersDark(true)
    applySettings({ ...getSettings(), theme: 'light' })

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('paints dark on a light system when dark is chosen explicitly', () => {
    mockPrefersDark(false)
    applySettings({ ...getSettings(), theme: 'dark' })

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  // Without this the page goes dark but the scrollbars and form controls stay
  // light, which looks like a rendering bug.
  it('keeps color-scheme in step with the painted theme', () => {
    mockPrefersDark(false)
    applySettings({ ...getSettings(), theme: 'dark' })

    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('still applies the other settings alongside the theme', () => {
    mockPrefersDark(false)
    applySettings({ soundEnabled: true, textSize: 'large', reducedMotion: true, theme: 'light' })

    expect(document.documentElement.dataset.textSize).toBe('large')
    expect(document.documentElement.classList.contains('force-reduced-motion')).toBe(true)
  })
})

describe('saveSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips the chosen theme', () => {
    saveSettings({ ...getSettings(), theme: 'dark' })
    expect(getSettings().theme).toBe('dark')
  })
})
