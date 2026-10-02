import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AdaptivePlay from './AdaptivePlay'
import { EMPTY_PROFILE, clearActiveAdaptations } from '../../lib/adaptations'
import { playWrong } from '../../lib/sound'
import { saveSettings, getSettings } from '../../lib/settings'
import { shortLevel, shortResult } from './adapt'

const config = { id: 'test-game' }

function Field({ onPick }) {
  return (
    <div>
      <button type="button" onClick={() => onPick('a')}>
        A
      </button>
      <button type="button" onClick={() => onPick('b')}>
        B
      </button>
      <button type="button" disabled onClick={() => onPick('c')}>
        C
      </button>
    </div>
  )
}

function renderWith(profile, gameConfig = config) {
  const onPick = vi.fn()
  render(
    <AdaptivePlay config={gameConfig} profile={{ ...EMPTY_PROFILE, ...profile }}>
      <Field onPick={onPick} />
    </AdaptivePlay>,
  )
  return onPick
}

beforeEach(() => {
  vi.useFakeTimers()
  clearActiveAdaptations()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AdaptivePlay — hold to activate', () => {
  it('a plain tap does nothing', () => {
    const onPick = renderWith({ holdMs: 500 })
    fireEvent.click(screen.getByText('A'), { detail: 1 })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('holding long enough presses the button once', () => {
    const onPick = renderWith({ holdMs: 500 })
    const button = screen.getByText('A')
    fireEvent.pointerDown(button)
    act(() => vi.advanceTimersByTime(499))
    expect(onPick).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onPick).toHaveBeenCalledWith('a')
    // Відпущений палець дає рідний клік — він не має стати другою відповіддю.
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail: 1 })
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('letting go early cancels', () => {
    const onPick = renderWith({ holdMs: 500 })
    fireEvent.pointerDown(screen.getByText('A'))
    act(() => vi.advanceTimersByTime(300))
    fireEvent.pointerUp(window)
    act(() => vi.advanceTimersByTime(500))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('keyboard is not delayed', () => {
    const onPick = renderWith({ holdMs: 500 })
    fireEvent.click(screen.getByText('B'), { detail: 0 })
    expect(onPick).toHaveBeenCalledWith('b')
  })

  it('a game that measures the moment of pressing opts out', () => {
    const onPick = renderWith({ holdMs: 500 }, { id: 'rt', input: { hold: false } })
    fireEvent.click(screen.getByText('A'), { detail: 1 })
    expect(onPick).toHaveBeenCalled()
  })
})

describe('AdaptivePlay — ignore repeated presses', () => {
  it('drops a second tap within the window', () => {
    const onPick = renderWith({ repeatGuardMs: 600 })
    fireEvent.click(screen.getByText('A'), { detail: 1 })
    fireEvent.click(screen.getByText('B'), { detail: 1 })
    expect(onPick).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(700))
  })

  it('drops the same key pressed twice, but not two different digits', () => {
    renderWith({ repeatGuardMs: 600 })
    const seen = []
    const listener = (event) => seen.push(event.key)
    window.addEventListener('keydown', listener)
    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '7' })
    window.removeEventListener('keydown', listener)
    expect(seen).toEqual(['1', '7'])
  })
})

describe('AdaptivePlay — one-button scanning', () => {
  it('highlights available buttons in turn and Space picks the highlighted one', () => {
    const onPick = renderWith({ scanMs: 1000 })
    expect(screen.getByText('A')).toHaveAttribute('data-scan-current')

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('B')).toHaveAttribute('data-scan-current')
    expect(screen.getByText('A')).not.toHaveAttribute('data-scan-current')

    // Вимкнену кнопку перебір оминає.
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('A')).toHaveAttribute('data-scan-current')

    const gameSpace = vi.fn()
    window.addEventListener('keydown', gameSpace)
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    window.removeEventListener('keydown', gameSpace)

    expect(onPick).toHaveBeenCalledWith('a')
    // Гра не отримала той самий Пробіл ще й як свою відповідь.
    expect(gameSpace).not.toHaveBeenCalled()
  })

  it('offers a big select button', () => {
    const onPick = renderWith({ scanMs: 1000 })
    fireEvent.click(screen.getByRole('button', { name: 'Вибрати' }))
    expect(onPick).toHaveBeenCalledWith('a')
  })

  it('is not used in a game that already has one button', () => {
    renderWith({ scanMs: 1000 }, { id: 'rt', input: { scan: 'native' } })
    expect(screen.queryByRole('button', { name: 'Вибрати' })).toBeNull()
  })
})

describe('AdaptivePlay — gentle reaction to a mistake', () => {
  it('shows a calm “try again” only in the gentle mode', () => {
    renderWith({})
    act(() => playWrong())
    expect(screen.queryByText('Спробуй ще')).toBeNull()

    saveSettings({ ...getSettings(), errorFeedback: 'gentle' })
    act(() => playWrong())
    expect(screen.getByText('Спробуй ще')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.queryByText('Спробуй ще')).toBeNull()
  })
})

describe('shorter attempts', () => {
  const plain = {}

  it('caps trials or rounds and marks the attempt', () => {
    expect(shortLevel(plain, { trialCount: 20 }, 6)).toEqual({ trialCount: 6, short: true })
    expect(shortLevel(plain, { rounds: 12 }, 6)).toEqual({ rounds: 6, short: true })
    const result = shortResult({ short: true }, { score: 80, entries: [], metrics: { total: 6 } })
    expect(result.metrics.short_attempt).toBe(true)
    expect(result.entries.at(-1)).toEqual({ label: 'Спроба', value: 'Коротка' })
  })

  it('leaves alone what is already short or not made of trials', () => {
    const level = { trialCount: 5 }
    expect(shortLevel(plain, level, 6)).toBe(level)
    const grid = { size: 5 }
    expect(shortLevel(plain, grid, 6)).toBe(grid)
    expect(shortLevel(plain, { trialCount: 20 }, 0)).toEqual({ trialCount: 20 })
  })
})

describe('AdaptivePlay — focus outside the field', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('Space on a focused button outside the field stays that button’s', () => {
    const onPick = vi.fn()
    render(
      <>
        <button type="button">Продовжити гру</button>
        <AdaptivePlay config={config} profile={{ ...EMPTY_PROFILE, scanMs: 1000 }}>
          <Field onPick={onPick} />
        </AdaptivePlay>
      </>,
    )
    const outside = screen.getByText('Продовжити гру')
    outside.focus()
    fireEvent.keyDown(outside, { key: ' ', code: 'Space' })
    expect(onPick).not.toHaveBeenCalled()
  })
})
