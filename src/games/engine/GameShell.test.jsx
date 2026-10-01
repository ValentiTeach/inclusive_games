import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GameShell from './GameShell'
import { getResults } from './storage'
import { getSettings, saveSettings } from '../../lib/settings'

vi.mock('../../lib/cloudSync', () => ({ pushResult: vi.fn(), pushRating: vi.fn() }))

const config = {
  id: 'fake-game',
  title: 'Тестова гра',
  category: 'attention',
  description: 'Опис.',
  instructions: ['Перший крок.', 'Другий крок.'],
  practice: { hint: 'Тисни на зелене, чекай на червоному.' },
  relaxed: {
    note: 'Фігуру видно довше.',
    level: (level) => ({ ...level, windowMs: level.windowMs * 2 }),
  },
  levels: [{ id: 'only', label: 'Єдиний', trialCount: 20, windowMs: 800 }],
}

const RESULT = {
  score: 70,
  entries: [{ label: 'Правильно', value: '7 / 10' }],
  metrics: { total: 10, correct: 7 },
}

let played

// Екран результатів питає систему про «менше руху», а jsdom matchMedia не має.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

function renderShell() {
  played = []
  // Роутер — для кнопки «До каталогу ігор» на екрані результатів.
  return render(
    <MemoryRouter>
      <GameShell
        config={config}
        renderPlay={(level, onFinish) => {
          played.push(level)
          return (
            <button type="button" onClick={() => onFinish(RESULT)}>
              Дограти
            </button>
          )
        }}
      />
    </MemoryRouter>,
  )
}

// Кожен крок відліку — окремий таймер, який ставить ефект після рендера,
// тож час просувається кроками, а не одним стрибком.
function passCountdown() {
  for (let step = 0; step < 4; step++) {
    act(() => {
      vi.advanceTimersByTime(700)
    })
  }
}

describe('пробна гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('іде скороченим рівнем і з підказкою правила', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Спершу спробувати' }))

    // Підказка видна вже на відліку — щоб її встигли прочитати до першої фігури.
    expect(screen.getByText('Тисни на зелене, чекай на червоному.')).toBeInTheDocument()
    passCountdown()

    expect(played.at(-1)).toMatchObject({ trialCount: 3, practice: true })
    expect(screen.getByText(/бали не рахуються/)).toBeInTheDocument()
  })

  it('нікуди не записується', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Спершу спробувати' }))
    passCountdown()
    fireEvent.click(screen.getByRole('button', { name: 'Дограти' }))

    expect(screen.getByRole('heading', { name: 'Пробну гру завершено' })).toBeInTheDocument()
    expect(getResults('fake-game')).toEqual([])
    // Бал пробної гри не показується: там не було заліку.
    expect(screen.queryByText('70')).toBeNull()
  })

  it('після проби справжня гра йде повним рівнем і зберігається', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Спершу спробувати' }))
    passCountdown()
    fireEvent.click(screen.getByRole('button', { name: 'Дограти' }))

    fireEvent.click(screen.getByRole('button', { name: 'Почати гру' }))
    passCountdown()
    expect(played.at(-1)).toMatchObject({ trialCount: 20 })
    expect(played.at(-1).practice).toBeUndefined()
    expect(screen.queryByText(/бали не рахуються/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Дограти' }))
    expect(getResults('fake-game')).toHaveLength(1)
  })

  it('з проби виходять без питання — втрачати нічого', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Спершу спробувати' }))
    passCountdown()

    fireEvent.click(screen.getByRole('button', { name: 'Вийти' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Почати' })).toBeInTheDocument()
  })

  it('поле не отримує новий рівень, поки гра триває', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Почати' }))
    passCountdown()
    const before = played.at(-1)

    // Питання про вихід перерендерює оболонку — рівень мусить лишитися тим
    // самим об'єктом, інакше поле перегенерувало б пробу посеред гри.
    fireEvent.click(screen.getByRole('button', { name: 'Вийти' }))
    expect(played.at(-1)).toBe(before)
  })
})

describe('без поспіху', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('перемикач перед грою запам’ятовується в налаштуваннях', () => {
    renderShell()
    const toggle = screen.getByRole('button', { name: 'Без поспіху' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(getSettings().pace).toBe('relaxed')
    expect(screen.getByText('Фігуру видно довше.')).toBeInTheDocument()
  })

  it('дає більше часу і позначає спробу', () => {
    saveSettings({ ...getSettings(), pace: 'relaxed' })
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Почати' }))
    passCountdown()

    expect(played.at(-1)).toMatchObject({ windowMs: 1600, relaxed: true })

    fireEvent.click(screen.getByRole('button', { name: 'Дограти' }))
    const [saved] = getResults('fake-game')
    expect(saved.metrics.relaxed_pace).toBe(true)
    expect(screen.getByText('Без поспіху')).toBeInTheDocument()
  })

  it('пробна гра без поспіху теж повільніша', () => {
    saveSettings({ ...getSettings(), pace: 'relaxed' })
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Спершу спробувати' }))
    passCountdown()

    expect(played.at(-1)).toMatchObject({ windowMs: 1600, trialCount: 3, practice: true })
  })
})
