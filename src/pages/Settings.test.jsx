import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './Settings'
import { getSettings } from '../lib/settings'

describe('Settings — theme switch', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('starts on "system"', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: 'Системна' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('applies dark immediately, without waiting for a reload', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Темна' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('remembers the choice for the next visit', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Темна' }))

    expect(getSettings().theme).toBe('dark')
  })

  it('can go back to light from dark', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Темна' }))
    await user.click(screen.getByRole('button', { name: 'Світла' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Світла' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Theme, text size and sound share one stored object; changing one must not
  // quietly reset the others.
  it('does not disturb the other settings', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Великий' }))
    await user.click(screen.getByRole('button', { name: 'Темна' }))

    const saved = getSettings()
    expect(saved.textSize).toBe('large')
    expect(saved.theme).toBe('dark')
  })
})
