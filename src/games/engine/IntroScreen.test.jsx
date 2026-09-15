import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import IntroScreen from './IntroScreen'

vi.mock('../../lib/sound', () => ({ playClick: vi.fn() }))

const config = {
  description: 'Опис гри.',
  instructions: ['Крок перший.'],
  levels: [
    { id: 'easy', label: 'Легко' },
    { id: 'hard', label: 'Складно' },
  ],
}

function show(props) {
  render(
    <IntroScreen
      config={config}
      levelId="easy"
      onLevelChange={() => {}}
      onStart={() => {}}
      history={[]}
      {...props}
    />,
  )
}

describe('пояснення підібраного рівня', () => {
  it('мовчить, коли рівень обрала сама дитина', () => {
    show({ isAutoSuggested: false })

    expect(screen.queryByText(/підібрано/)).toBeNull()
  })

  it('посилається на попередній результат, коли він є', () => {
    show({ isAutoSuggested: true, history: [{ levelId: 'easy', score: 90, date: '2026-09-10', entries: [] }] })

    expect(screen.getByText(/за твоїм попереднім результатом/)).toBeTruthy()
  })

  /**
   * Дитина відкриває гру вперше — «за твоїм попереднім результатом» тут було б
   * відвертою неправдою: жодного результату в цій грі ще немає.
   */
  it('у першій грі посилається на схожі ігри, а не на неіснуючу спробу', () => {
    show({ isAutoSuggested: true, history: [] })

    expect(screen.getByText(/за схожими іграми/)).toBeTruthy()
    expect(screen.queryByText(/попереднім результатом/)).toBeNull()
  })
})
