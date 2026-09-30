import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

describe('темп перед грою', () => {
  const timed = {
    ...config,
    relaxed: { note: 'Фігуру видно довше.', level: (level) => level },
  }

  it('пропонує «без поспіху» там, де гра обмежує час', () => {
    show({ config: timed, pace: 'normal', onPaceChange: () => {} })

    expect(screen.getByRole('button', { name: 'Без поспіху' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('не пропонує перемикача, який нічого не змінить', () => {
    show({ pace: 'normal', onPaceChange: () => {} })

    expect(screen.queryByRole('button', { name: 'Без поспіху' })).toBeNull()
  })

  it('коли «без поспіху» ввімкнено, пояснює, чому в цій грі нічого не змінилось', () => {
    show({ pace: 'relaxed', onPaceChange: () => {} })

    expect(screen.getByText(/немає обмеження часу/)).toBeTruthy()
  })
})

describe('пробна гра', () => {
  it('новачкові пояснює, що проба не рахується', () => {
    show({ onPractice: () => {}, history: [] })

    expect(screen.getByRole('button', { name: 'Спершу спробувати' })).toBeTruthy()
    expect(screen.getByText(/бали в ній не рахуються/)).toBeTruthy()
  })

  it('тому, хто вже грав, лишає кнопку, але без пояснення', () => {
    show({
      onPractice: () => {},
      history: [{ levelId: 'easy', score: 60, date: '2026-09-10', entries: [] }],
    })

    expect(screen.getByRole('button', { name: 'Спершу спробувати' })).toBeTruthy()
    expect(screen.queryByText(/бали в ній не рахуються/)).toBeNull()
  })
})

describe('озвучення', () => {
  afterEach(() => {
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })

  function withVoices(voices) {
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text
      }
    }
    window.speechSynthesis = {
      getVoices: () => voices,
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  }

  it('читає опис та інструкцію українським голосом', () => {
    withVoices([{ name: 'Lesya', lang: 'uk-UA', localService: true }])
    show()

    fireEvent.click(screen.getByRole('button', { name: 'Послухати' }))

    const [utterance] = window.speechSynthesis.speak.mock.calls[0]
    expect(utterance.text).toBe('Опис гри. Крок перший.')
  })

  it('без українського голосу кнопки немає — англійський голос зіпсував би текст', () => {
    withVoices([{ name: 'Samantha', lang: 'en-US', localService: true }])
    show()

    expect(screen.queryByRole('button', { name: 'Послухати' })).toBeNull()
  })
})
