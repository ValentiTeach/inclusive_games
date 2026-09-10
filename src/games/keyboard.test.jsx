import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import StroopPlayArea from './stroop/StroopPlayArea'
import { config as stroopConfig } from './stroop/stroop.config'
import QuickMathPlayArea from './quick-math/QuickMathPlayArea'
import { config as quickMathConfig } from './quick-math/quickMath.config'
import SubitizingPlayArea from './subitizing/SubitizingPlayArea'
import { config as subitizingConfig } from './subitizing/subitizing.config'
import MatricesPlayArea from './matrices/MatricesPlayArea'
import { config as matricesConfig } from './matrices/matrices.config'
import MentalRotationPlayArea from './mental-rotation/MentalRotationPlayArea'
import { config as mentalRotationConfig } from './mental-rotation/mentalRotation.config'
import SimonPlayArea from './simon/SimonPlayArea'
import { config as simonConfig } from './simon/simon.config'
import ReactionTimePlayArea from './reaction-time/ReactionTimePlayArea'
import { config as reactionTimeConfig } from './reaction-time/reactionTime.config'
import GoNoGoPlayArea from './go-no-go/GoNoGoPlayArea'
import { config as goNoGoConfig } from './go-no-go/goNoGo.config'
import NBackPlayArea from './n-back/NBackPlayArea'
import { config as nbackConfig } from './n-back/nback.config'

function press(key, times = 1) {
  // Кілька натискань усередині одного act() — це і є гонка, яку треба вміти
  // відтворити: React не встигає перерендерити між ними, тож обидва обробники
  // бачать той самий стан. Окремі act() змили б стан і перевіряли б зовсім
  // інший сценарій.
  act(() => {
    for (let i = 0; i < times; i++) {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          code: key === ' ' ? 'Space' : undefined,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  })
}

function tick(ms) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function optionsAreLocked(selector) {
  const buttons = document.querySelectorAll(selector)
  expect(buttons.length).toBeGreaterThan(0)
  return [...buttons].every((button) => button.disabled)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Кожна з дев'яти ігор перевіряється однією властивістю: клавіша робить те саме,
 * що робив би клік. Спостережуване різне — десь варіанти замикаються, десь
 * змінюється фаза, — але твердження одне.
 */
describe('цифри відповідають замість кліку', () => {
  it('Струп', () => {
    render(<StroopPlayArea level={stroopConfig.levels[0]} onFinish={vi.fn()} />)

    expect(optionsAreLocked('.stroop__option')).toBe(false)
    press('1')

    expect(optionsAreLocked('.stroop__option')).toBe(true)
  })

  it('Швидкий рахунок', () => {
    render(<QuickMathPlayArea level={quickMathConfig.levels[0]} onFinish={vi.fn()} />)

    press('1')

    expect(optionsAreLocked('.quick-math__option')).toBe(true)
  })

  it('Матриці', () => {
    render(<MatricesPlayArea level={matricesConfig.levels[0]} onFinish={vi.fn()} />)

    press('1')

    expect(optionsAreLocked('.matrices__option')).toBe(true)
  })

  it('Мисленне обертання', () => {
    render(<MentalRotationPlayArea level={mentalRotationConfig.levels[0]} onFinish={vi.fn()} />)

    press('1')

    expect(optionsAreLocked('.mental-rotation__option')).toBe(true)
  })

  // Варіантів два і вони лежать поруч, тож стрілка тут читається так само
  // природно, як цифра.
  it('Мисленне обертання приймає і стрілки', () => {
    render(<MentalRotationPlayArea level={mentalRotationConfig.levels[0]} onFinish={vi.fn()} />)

    press('ArrowRight')

    expect(optionsAreLocked('.mental-rotation__option')).toBe(true)
  })

  it('Субітизація — після того, як крапки згасли', () => {
    const level = subitizingConfig.levels[0]
    render(<SubitizingPlayArea level={level} onFinish={vi.fn()} />)

    tick(level.flashMs)
    expect(screen.getByText('Скільки було крапок?')).toBeInTheDocument()
    press('1')

    expect(optionsAreLocked('.subitizing__option')).toBe(true)
  })

  /**
   * Відповідь до появи питання — це не швидка реакція, а випадкове натискання.
   * Проба має лишитись на місці.
   */
  it('Субітизація мовчить, поки крапки ще на екрані', () => {
    const level = subitizingConfig.levels[0]
    render(<SubitizingPlayArea level={level} onFinish={vi.fn()} />)

    press('1')
    tick(level.flashMs)

    expect(screen.getByText(`1 / ${level.trialCount}`)).toBeInTheDocument()
  })

  /**
   * Саймон грається по-справжньому: тест дивиться, яка плитка засвітилась у
   * показі, і натискає саме її цифру. Помилкове натискання завершило б гру,
   * тож проходження раунду і є доказом, що клавіша спрацювала правильно.
   */
  it('Саймон — повторення показаного кроку з клавіатури', () => {
    render(<SimonPlayArea level={simonConfig.levels[0]} onFinish={vi.fn()} />)

    tick(500)
    const pads = [...document.querySelectorAll('.simon__pad')]
    const shown = pads.findIndex((pad) => pad.classList.contains('is-active'))
    expect(shown).toBeGreaterThanOrEqual(0)

    tick(1200)
    expect(screen.getByText('Повтори послідовність')).toBeInTheDocument()

    press(String(shown + 1))

    expect(screen.getByText('Дивись уважно…')).toBeInTheDocument()
    expect(screen.getByText('Довжина послідовності: 2')).toBeInTheDocument()
  })

  // Натискання не мало жодного відгуку — ані мишею, ані з клавіатури. З мишею
  // дитина хоч бачила курсор на плитці, з клавіатури не бачила нічого.
  it('Саймон підсвічує плитку, яку натиснули', () => {
    render(<SimonPlayArea level={simonConfig.levels[0]} onFinish={vi.fn()} />)

    tick(500)
    const shown = [...document.querySelectorAll('.simon__pad')].findIndex((pad) =>
      pad.classList.contains('is-active'),
    )
    tick(1200)

    press(String(shown + 1))
    const lit = [...document.querySelectorAll('.simon__pad')].filter((pad) =>
      pad.classList.contains('is-active'),
    )

    expect(lit).toHaveLength(1)
  })
})

describe('пробіл замість кліку', () => {
  it('Час реакції — зарано натиснута клавіша рахується як фальстарт', () => {
    render(<ReactionTimePlayArea level={reactionTimeConfig.levels[0]} onFinish={vi.fn()} />)

    expect(screen.getByText('Чекай…')).toBeInTheDocument()
    press(' ')

    expect(screen.getByText('Зарано! Спробуй ще раз')).toBeInTheDocument()
  })

  it('Час реакції — по сигналу клавіша зараховує раунд', () => {
    render(<ReactionTimePlayArea level={reactionTimeConfig.levels[0]} onFinish={vi.fn()} />)

    // randomDelayMs() — це 1000–3000 мс, тож коротший тік давав би фальстарт
    // через раз і робив би тест плаваючим.
    tick(3000)
    expect(screen.getByText('Тисни!')).toBeInTheDocument()

    press(' ')

    expect(screen.getByText('Раунд 2 / 5')).toBeInTheDocument()
  })

  /**
   * Один сигнал — один час. Статус лежить у стані, тож два натискання в одному
   * такті обидва побачили б ще 'ready' і записали б два часи на один сигнал.
   * Мишею так швидко не клацнути, клавіатурою — цілком.
   */
  it('Час реакції не зараховує двох відповідей на один сигнал', () => {
    const onFinish = vi.fn()
    const level = reactionTimeConfig.levels[0]
    render(<ReactionTimePlayArea level={level} onFinish={onFinish} />)

    for (let round = 0; round < level.rounds; round++) {
      tick(3000)
      press(' ', 2)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.total).toBe(level.rounds)
  })

  /**
   * Час реакції існує тільки для натиснутої проби, тож rt_count — це прямий
   * лічильник того, скільки разів клавіша спрацювала.
   */
  it('Go/No-Go зараховує натискання пробілом', () => {
    const onFinish = vi.fn()
    const level = goNoGoConfig.levels[0]
    render(<GoNoGoPlayArea level={level} onFinish={onFinish} />)

    for (let trial = 0; trial < level.trialCount; trial++) {
      press(' ')
      tick(level.windowMs + 400)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.rt_count).toBe(level.trialCount)
  })

  it('N-back зараховує натискання пробілом', () => {
    const onFinish = vi.fn()
    const level = nbackConfig.levels[0]
    render(<NBackPlayArea level={level} onFinish={onFinish} />)

    for (let trial = 0; trial < level.trialCount; trial++) {
      press(' ')
      tick(level.stimulusMs + 350)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    // Перші n проб відповідей не приймають — там ще нема з чим порівнювати.
    expect(onFinish.mock.calls[0][0].metrics.rt_count).toBe(level.trialCount - level.n)
  })
})

describe('розкладку видно, а не треба вгадувати', () => {
  it.each([
    ['Струп', <StroopPlayArea key="s" level={stroopConfig.levels[0]} onFinish={vi.fn()} />, 4],
    [
      'Швидкий рахунок',
      <QuickMathPlayArea key="q" level={quickMathConfig.levels[0]} onFinish={vi.fn()} />,
      4,
    ],
    [
      'Матриці',
      <MatricesPlayArea key="m" level={matricesConfig.levels[0]} onFinish={vi.fn()} />,
      4,
    ],
    [
      'Мисленне обертання',
      <MentalRotationPlayArea key="r" level={mentalRotationConfig.levels[0]} onFinish={vi.fn()} />,
      2,
    ],
    ['Саймон', <SimonPlayArea key="p" level={simonConfig.levels[0]} onFinish={vi.fn()} />, 4],
  ])('%s нумерує свої варіанти', (_name, element, expected) => {
    render(element)

    const badges = document.querySelectorAll('.option-key')
    expect(badges).toHaveLength(expected)
    expect([...badges].map((badge) => badge.textContent)).toEqual(
      Array.from({ length: expected }, (_, index) => String(index + 1)),
    )
  })

  // Гра без підказки — це гра, у яку з клавіатури не здогадаєшся зіграти.
  it.each([
    ['Струп', stroopConfig],
    ['Швидкий рахунок', quickMathConfig],
    ['Субітизація', subitizingConfig],
    ['Матриці', matricesConfig],
    ['Мисленне обертання', mentalRotationConfig],
    ['Саймон', simonConfig],
    ['Час реакції', reactionTimeConfig],
    ['Go/No-Go', goNoGoConfig],
    ['N-back', nbackConfig],
  ])('%s каже, якими клавішами в неї грати', (_name, config) => {
    expect(config.keyHint).toBeDefined()
    expect(config.keyHint.keys).toBeTruthy()
    expect(config.keyHint.text).toBeTruthy()
  })
})
