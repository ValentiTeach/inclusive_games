import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useGameKeys } from './useGameKeys'

const calls = []

function Harness({ children, ...options }) {
  useGameKeys({
    onOption: (index) => calls.push(`option:${index}`),
    onSpace: () => calls.push('space'),
    onEnter: () => calls.push('enter'),
    onArrow: (direction) => calls.push(`arrow:${direction}`),
    ...options,
  })
  return <div>{children}</div>
}

/**
 * Подія створюється вручну, а не через fireEvent, бо половина перевірок тут —
 * саме про defaultPrevented: без нього Пробіл на сфокусованій кнопці дав би і
 * рідний клік, і наш обробник.
 */
function press(key, init = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  // act() тут не косметика: без нього оновлення стану з обробника не змиваються
  // до наступного рядка тесту, і перевірка бачила б лічильник на нулі.
  act(() => {
    ;(init.target ?? window).dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  calls.length = 0
})

describe('useGameKeys — що ловить', () => {
  it('reports the option zero-based, so a caller can index its options', () => {
    render(<Harness optionCount={4} />)

    press('1')
    press('4')

    expect(calls).toEqual(['option:0', 'option:3'])
  })

  it('routes space, enter and each arrow', () => {
    render(<Harness />)

    press(' ')
    press('Enter')
    press('ArrowLeft')
    press('ArrowRight')
    press('ArrowUp')
    press('ArrowDown')

    expect(calls).toEqual([
      'space',
      'enter',
      'arrow:left',
      'arrow:right',
      'arrow:up',
      'arrow:down',
    ])
  })

  it('works without focusing anything first', () => {
    render(<Harness optionCount={4} />)

    expect(document.activeElement).toBe(document.body)
    press('2')

    expect(calls).toEqual(['option:1'])
  })
})

describe('useGameKeys — чого не ловить', () => {
  /**
   * Найважливіша перевірка файлу. Дитина, що дійшла до варіанта Tab'ом і
   * натисла Пробіл, інакше дала б дві відповіді на одну пробу: рідну активацію
   * кнопки і цей обробник.
   */
  it('cancels the key so a focused button cannot fire a second time', () => {
    render(<Harness optionCount={4} />)

    expect(press(' ').defaultPrevented).toBe(true)
    expect(press('Enter').defaultPrevented).toBe(true)
    expect(press('1').defaultPrevented).toBe(true)
    expect(press('ArrowLeft').defaultPrevented).toBe(true)
  })

  it('ignores a held key instead of queueing answers', () => {
    render(<Harness optionCount={4} />)

    press('1', { repeat: true })

    expect(calls).toEqual([])
  })

  // Ctrl+1 перемикає вкладку, Alt+← вертає назад. Гра не має їх з'їдати.
  it.each([['ctrlKey'], ['altKey'], ['metaKey']])('leaves %s combinations to the browser', (mod) => {
    render(<Harness optionCount={4} />)

    const event = press('1', { [mod]: true })

    expect(calls).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('stays out of the way while someone is typing in a field', () => {
    render(
      <Harness optionCount={4}>
        <input aria-label="поле" />
      </Harness>,
    )

    press('1', { target: screen.getByLabelText('поле') })

    expect(calls).toEqual([])
  })

  /**
   * Гра з чотирма варіантами не має з'їдати «7»: якщо клавіша нічого не
   * означає, хай браузер робить із нею що звично.
   */
  it('leaves a digit past the last option alone', () => {
    render(<Harness optionCount={4} />)

    const event = press('7')

    expect(calls).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('goes silent while disabled', () => {
    render(<Harness optionCount={4} enabled={false} />)

    press('1')
    press(' ')

    expect(calls).toEqual([])
  })

  it('does not invent a handler the caller never passed', () => {
    render(<Harness onSpace={undefined} onEnter={undefined} onArrow={undefined} optionCount={4} />)

    const event = press(' ')

    expect(calls).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('useGameKeys — свіжість обробника', () => {
  /**
   * Слухач підписується один раз на весь час гри, тож він мусить читати
   * актуальний обробник. Інакше клавіша відповідала б на пробу, яка вже минула,
   * — а в грі стан змінюється щосекунди.
   */
  it('sees the current state, not the one from when it subscribed', () => {
    function Counter() {
      const [count, setCount] = useState(0)
      useGameKeys({ onSpace: () => setCount((value) => value + 1) })
      return <p>{`лічильник: ${count}`}</p>
    }

    render(<Counter />)

    press(' ')
    press(' ')
    press(' ')

    expect(screen.getByText('лічильник: 3')).toBeInTheDocument()
  })
})

describe('useGameKeys — сирі цифри для набору числа', () => {
  /**
   * Інша річ, ніж onOption. У сітці Шульте 6×6 є 10, 20 і 30 — без нуля їх не
   * набрати, а «нульового варіанта» не існує в жодній грі.
   */
  it('reports the digit itself, zero included', () => {
    render(<Harness onOption={undefined} onDigit={(digit) => calls.push(`d:${digit}`)} />)

    press('1')
    press('0')
    press('9')

    expect(calls).toEqual(['d:1', 'd:0', 'd:9'])
  })

  it('cancels the key so a focused button cannot also fire', () => {
    render(<Harness onOption={undefined} onDigit={() => {}} />)

    expect(press('0').defaultPrevented).toBe(true)
  })

  // Гра користується чимось одним, але якщо задані обидва — цифра в межах
  // варіантів іде у вибір, решта в набір.
  it('prefers the option handler inside its range and falls through outside it', () => {
    render(<Harness optionCount={4} onDigit={(digit) => calls.push(`d:${digit}`)} />)

    press('2')
    press('7')
    press('0')

    expect(calls).toEqual(['option:1', 'd:7', 'd:0'])
  })

  it('leaves digits alone when a game wants neither', () => {
    render(<Harness onOption={undefined} onDigit={undefined} optionCount={0} />)

    const event = press('5')

    expect(calls).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('useGameKeys — скасування набору', () => {
  it.each([['Escape'], ['Backspace']])('%s clears what was typed', (key) => {
    render(<Harness onCancel={() => calls.push('cancel')} />)

    expect(press(key).defaultPrevented).toBe(true)
    expect(calls).toEqual(['cancel'])
  })

  it('leaves Backspace to the browser when no game is typing', () => {
    render(<Harness onCancel={undefined} />)

    expect(press('Backspace').defaultPrevented).toBe(false)
  })
})
