import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import TrafficLightPlayArea from './TrafficLightPlayArea'
import { SIGNALS, config, nextSignal, randomDelayMs, scoring, signalsOfLevel } from './trafficLight.config'

const THREE = config.levels[1]

function press(key) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function litIndex() {
  const lamps = [...document.querySelectorAll('.traffic__lamp')]
  return lamps.findIndex((lamp) => lamp.classList.contains('is-lit'))
}

describe('сигнали', () => {
  it('рівень із двома вогнями не показує третій', () => {
    expect(signalsOfLevel(config.levels[0])).toHaveLength(2)
    expect(signalsOfLevel(config.levels[0]).map((s) => s.id)).toEqual(['red', 'yellow'])
  })

  /**
   * Той самий вогонь двічі поспіль перетворює реакцію вибору на просту: палець
   * уже лежить на потрібній кнопці, і гра перестає міряти те, заради чого вона є.
   */
  it('не повторює той самий вогонь двічі поспіль', () => {
    for (let i = 0; i < 60; i++) {
      expect(nextSignal(THREE, 'green').id).not.toBe('green')
    }
  })

  it('пауза перед сигналом завжди різна і в межах секунди-трьох', () => {
    const values = Array.from({ length: 50 }, () => randomDelayMs())

    expect(Math.min(...values)).toBeGreaterThanOrEqual(900)
    expect(Math.max(...values)).toBeLessThanOrEqual(3000)
    expect(new Set(values.map(Math.round)).size).toBeGreaterThan(20)
  })

  /**
   * Підказка клавіш стоїть у config і однакова для всіх рівнів, а кількість
   * кнопок — ні. «1–3» на рівні з двома вогнями обіцяло б клавішу, якої там
   * немає.
   */
  it('підказка клавіш не обіцяє кнопок, яких немає на рівні', () => {
    expect(config.keyHint.keys).not.toMatch(/\d/)
  })

  it('кожен вогонь має власну кнопку з назвою', () => {
    expect(new Set(SIGNALS.map((s) => s.action)).size).toBe(SIGNALS.length)
  })
})

describe('оцінка', () => {
  const fast = (correct) => ({ correct, reactionTimeMs: 450 })

  /**
   * Три кнопки означають, що третина влучань дістається навмання. Якби бал
   * додавав швидкість і точність, дитина, яка тисне абияк, але швидко, мала б
   * пристойний результат.
   */
  it('навмання і швидко — це не добрий результат', () => {
    const guessing = scoring([fast(true), fast(false), fast(false)])
    const careful = scoring([fast(true), fast(true), fast(true)])

    expect(guessing.score).toBeLessThan(careful.score / 2)
  })

  it('точність без швидкості теж не дає повного балу', () => {
    const slow = scoring([
      { correct: true, reactionTimeMs: 1400 },
      { correct: true, reactionTimeMs: 1400 },
    ])

    expect(slow.metrics.accuracy_pct).toBe(100)
    expect(slow.score).toBeLessThan(20)
  })

  it('передчасні натискання показуються окремо від точності', () => {
    const { metrics, entries } = scoring([fast(true), fast(true)], { early_presses: 3 })
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics.accuracy_pct).toBe(100)
    expect(metrics.early_presses).toBe(3)
    expect(byLabel['Натиснув зарано']).toBe('3')
  })

  it('без жодної відповіді бал нульовий, а не NaN', () => {
    expect(scoring([]).score).toBe(0)
  })
})

describe('гра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function lightUp() {
    // Пауза до сигналу — 900..3000 мс, тож 3000 гарантовано її вичерпує.
    act(() => vi.advanceTimersByTime(3000))
  }

  it('до сигналу жоден вогонь не горить', () => {
    render(<TrafficLightPlayArea level={THREE} onFinish={vi.fn()} />)

    expect(litIndex()).toBe(-1)
    expect(screen.getByText('Чекай…')).toBeInTheDocument()
  })

  it('правильна кнопка веде до наступного раунду', () => {
    render(<TrafficLightPlayArea level={THREE} onFinish={vi.fn()} />)
    lightUp()

    press(String(litIndex() + 1))
    expect(screen.getByText('Точно!')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(600))
    expect(screen.getByText(`Раунд 2 / ${THREE.rounds}`)).toBeInTheDocument()
  })

  it('чужа кнопка — помилка, але раунд усе одно минає', () => {
    const onFinish = vi.fn()
    render(<TrafficLightPlayArea level={THREE} onFinish={onFinish} />)

    for (let round = 0; round < THREE.rounds; round++) {
      lightUp()
      const wrong = ((litIndex() + 1) % 3) + 1
      press(String(wrong))
      act(() => vi.advanceTimersByTime(600))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.correct).toBe(0)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(THREE.rounds)
  })

  /**
   * Натискання до сигналу — спроба вгадати, а не помилка вибору. Якби воно
   * потрапляло в точність, дитина, яка вгадала наперед і влучила, виглядала б
   * швидшою за ту, що чесно дочекалась вогню.
   */
  it('натискання до сигналу не псує точність, а рахується окремо', () => {
    const onFinish = vi.fn()
    render(<TrafficLightPlayArea level={THREE} onFinish={onFinish} />)

    press('1')
    expect(screen.getByText('Зарано — дочекайся вогню')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(800))

    for (let round = 0; round < THREE.rounds; round++) {
      lightUp()
      press(String(litIndex() + 1))
      act(() => vi.advanceTimersByTime(600))
    }

    const { metrics } = onFinish.mock.calls[0][0]
    expect(metrics.total).toBe(THREE.rounds)
    expect(metrics.accuracy_pct).toBe(100)
    expect(metrics.early_presses).toBe(1)
  })

  /**
   * Два натискання в одному такті: стан ще не оновився, і обидва обробники
   * бачать той самий вогонь. Мишею так не встигнути, клавіатурою — цілком.
   */
  it('одна відповідь на раунд, навіть якщо натиснути двічі поспіль', () => {
    const onFinish = vi.fn()
    render(<TrafficLightPlayArea level={THREE} onFinish={onFinish} />)
    lightUp()

    const correct = String(litIndex() + 1)
    act(() => {
      for (let i = 0; i < 3; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: correct, bubbles: true }))
      }
    })
    act(() => vi.advanceTimersByTime(600))

    for (let round = 1; round < THREE.rounds; round++) {
      lightUp()
      press(String(litIndex() + 1))
      act(() => vi.advanceTimersByTime(600))
    }

    expect(onFinish.mock.calls[0][0].metrics.total).toBe(THREE.rounds)
  })
})
