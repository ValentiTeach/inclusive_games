import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from './ThemeToggle'
import { getSettings, saveSettings } from '../../lib/settings'

function mockSystem(prefersDark) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('offers to go dark while the page is light', () => {
    mockSystem(false)
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: 'Увімкнути темну тему' })).toBeInTheDocument()
  })

  it('offers to go light while the page is dark', () => {
    mockSystem(true)
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: 'Увімкнути світлу тему' })).toBeInTheDocument()
  })

  it('switches the page on click', async () => {
    const user = userEvent.setup()
    mockSystem(false)
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Увімкнути темну тему' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(getSettings().theme).toBe('dark')
  })

  it('flips back on a second click', async () => {
    const user = userEvent.setup()
    mockSystem(false)
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Увімкнути темну тему' }))
    await user.click(screen.getByRole('button', { name: 'Увімкнути світлу тему' }))

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  // The button reads whatever is painted, so on a dark system it must offer
  // light even though the stored preference is still the default "system".
  it('reads the resolved theme, not the raw stored value', async () => {
    const user = userEvent.setup()
    mockSystem(true)
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Увімкнути світлу тему' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(getSettings().theme).toBe('light')
  })

  it('leaves the other settings alone', async () => {
    const user = userEvent.setup()
    mockSystem(false)
    saveSettings({ ...getSettings(), soundEnabled: false, textSize: 'large' })
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Увімкнути темну тему' }))

    const saved = getSettings()
    expect(saved.soundEnabled).toBe(false)
    expect(saved.textSize).toBe('large')
  })
})
