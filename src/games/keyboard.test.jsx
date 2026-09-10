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
import SchultePlayArea from './schulte/SchultePlayArea'
import { config as schulteConfig } from './schulte/schulte.config'
import MemoryPairsPlayArea from './memory-pairs/MemoryPairsPlayArea'
import { config as memoryPairsConfig } from './memory-pairs/memoryPairs.config'

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
    ['Таблиці Шульте', schulteConfig],
    ['Знайди пару', memoryPairsConfig],
  ])('%s каже, якими клавішами в неї грати', (_name, config) => {
    expect(config.keyHint).toBeDefined()
    expect(config.keyHint.keys).toBeTruthy()
    expect(config.keyHint.text).toBeTruthy()
  })
})

/**
 * Шульте — набір числа, а не навігація стрілками. Стрілки по сітці 5×5
 * перетворили б пробу зорового пошуку на вправу з навігації: дитина йшла б
 * клітинками, а не шукала б число очима. Тому клавіатура тут повторює не рух
 * миші, а сам намір — «я бачу сімнадцять».
 */
describe('Таблиці Шульте — набір числа', () => {
  function cells() {
    return [...document.querySelectorAll('.schulte__cell')]
  }

  function foundCount() {
    return cells().filter((cell) => cell.className.includes('--found')).length
  }

  // Ціль читаємо саме зі смужки стану: getByText('1') збігся б і з нею, і з
  // клітинкою «1» у сітці.
  function currentTarget() {
    return document.querySelector('.schulte__status strong').textContent
  }

  it('одна цифра зараховує однозначну ціль', () => {
    render(<SchultePlayArea level={schulteConfig.levels[0]} onFinish={vi.fn()} />)

    expect(currentTarget()).toBe('1')
    press('1')

    expect(currentTarget()).toBe('2')
    expect(foundCount()).toBe(1)
  })

  // Ціль відома, тож довжина набраного і є ознакою завершення: шукаєш 7 —
  // вистачить однієї цифри, шукаєш 17 — потрібні дві. Ані таймера, ані Enter.
  it('двоцифрова ціль чекає на другу цифру, а не спрацьовує на першій', () => {
    const level = schulteConfig.levels[0]
    render(<SchultePlayArea level={level} onFinish={vi.fn()} />)

    for (let n = 1; n <= 9; n++) press(String(n))
    expect(foundCount()).toBe(9)

    press('1')
    // Після однієї цифри ще нічого не сталося — але це має бути видно.
    expect(foundCount()).toBe(9)
    expect(screen.getByText('набрано: 1')).toBeInTheDocument()

    press('0')
    expect(foundCount()).toBe(10)
  })

  it('набране можна стерти, не чекаючи на помилку', () => {
    render(<SchultePlayArea level={schulteConfig.levels[0]} onFinish={vi.fn()} />)

    for (let n = 1; n <= 9; n++) press(String(n))
    press('9')
    expect(screen.getByText('набрано: 9')).toBeInTheDocument()

    press('Escape')
    expect(screen.queryByText(/набрано:/)).not.toBeInTheDocument()

    press('1')
    press('0')
    expect(foundCount()).toBe(10)
  })

  /**
   * Клавіша робить те саме, що клік. Знайдену клітинку не натиснути — вона
   * disabled, — тож і набране знайдене число не має ставати помилкою.
   */
  it('уже знайдене число не рахується помилкою', () => {
    const onFinish = vi.fn()
    const level = schulteConfig.levels[0]
    render(<SchultePlayArea level={level} onFinish={onFinish} />)

    press('1')
    press('1')
    press('1')

    for (let n = 2; n <= level.size * level.size; n++) {
      for (const digit of String(n)) press(digit)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.errors).toBe(0)
  })

  it('чуже число рахується помилкою так само, як хибний клік', () => {
    const onFinish = vi.fn()
    const level = schulteConfig.levels[0]
    render(<SchultePlayArea level={level} onFinish={onFinish} />)

    press('5')

    for (let n = 1; n <= level.size * level.size; n++) {
      for (const digit of String(n)) press(digit)
    }

    expect(onFinish.mock.calls[0][0].metrics.errors).toBe(1)
  })

  /**
   * Набрати число, більше за сітку, можна лише коли ціль сама двоцифрова —
   * інакше кожна цифра розв'язується окремо і «9» на сітці 4×4 це звичайна
   * клітинка. Тому спершу доходимо до двоцифрової цілі.
   */
  it('число поза сіткою просто ігнорується', () => {
    const onFinish = vi.fn()
    const level = schulteConfig.levels[0]
    const total = level.size * level.size
    render(<SchultePlayArea level={level} onFinish={onFinish} />)

    for (let n = 1; n <= 9; n++) press(String(n))
    expect(currentTarget()).toBe('10')

    // 99 на сітці 4×4 не існує — натиснути таку клітинку неможливо в принципі.
    press('9')
    press('9')
    expect(currentTarget()).toBe('10')

    for (let n = 10; n <= total; n++) {
      for (const digit of String(n)) press(digit)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.errors).toBe(0)
  })

  it('усю таблицю можна пройти самими цифрами', () => {
    const onFinish = vi.fn()
    const level = schulteConfig.levels[1]
    render(<SchultePlayArea level={level} onFinish={onFinish} />)

    for (let n = 1; n <= level.size * level.size; n++) {
      for (const digit of String(n)) press(digit)
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].metrics.grid_size).toBe(5)
  })
})

describe('Знайди пару — курсор по сітці', () => {
  function cards() {
    return [...document.querySelectorAll('.memory-pairs__card')]
  }

  function cursorIndex() {
    return cards().findIndex((card) => card.tabIndex === 0)
  }

  const level = memoryPairsConfig.levels[0] // 6 пар, 4 колонки → 12 карток, 3 рядки

  it('має один tabstop на всю сітку, а не двадцять кнопок', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    expect(cards()).toHaveLength(12)
    expect(cards().filter((card) => card.tabIndex === 0)).toHaveLength(1)
  })

  it('стрілки ходять по рядках і колонках', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    expect(cursorIndex()).toBe(0)
    press('ArrowRight')
    expect(cursorIndex()).toBe(1)
    press('ArrowDown')
    expect(cursorIndex()).toBe(5)
    press('ArrowLeft')
    expect(cursorIndex()).toBe(4)
    press('ArrowUp')
    expect(cursorIndex()).toBe(0)
  })

  /**
   * Курсор не перестрибує з кінця рядка на початок наступного. У грі на пам'ять
   * значення має саме розташування, і загортання збивало б просторову картину.
   */
  it('на краю сітки курсор лишається на місці, а не загортається', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    press('ArrowLeft')
    press('ArrowUp')
    expect(cursorIndex()).toBe(0)

    for (let i = 0; i < 10; i++) press('ArrowRight')
    expect(cursorIndex()).toBe(3)

    for (let i = 0; i < 10; i++) press('ArrowDown')
    expect(cursorIndex()).toBe(11)
  })

  it('Enter перевертає картку під курсором', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    press('ArrowRight')
    press('Enter')

    expect(cards()[1].className).toContain('is-flipped')
    expect(screen.getByText('Ходи: 0')).toBeInTheDocument()
  })

  it('Пробіл робить те саме, що Enter', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    press(' ')

    expect(cards()[0].className).toContain('is-flipped')
  })

  /**
   * Пастка, яку легко проґавити: якщо активувати «картку під курсором», а дитина
   * дійшла до іншої картки Tab'ом, перевернулася б зовсім не та. Курсор іде за
   * фокусом саме тому.
   */
  it('курсор іде за фокусом, тож Tab і Enter не розходяться', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    act(() => {
      cards()[7].focus()
    })
    expect(cursorIndex()).toBe(7)

    press('Enter')
    expect(cards()[7].className).toContain('is-flipped')
  })

  /**
   * Відкриті картки лишаються орієнтирами, повз які треба ходити, тож вони
   * мусять приймати фокус — звідси aria-disabled замість disabled. Натискання
   * на них усе одно нічого не робить.
   */
  it('відкрита картка не блокує курсор, але й не переживається вдруге', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    press('Enter')
    expect(cards()[0].getAttribute('aria-disabled')).toBe('true')
    expect(cards()[0].disabled).toBe(false)
    expect(screen.getByText('Ходи: 0')).toBeInTheDocument()

    press('Enter')
    expect(screen.getByText('Ходи: 0')).toBeInTheDocument()
  })

  it('пару можна зібрати самою клавіатурою', () => {
    render(<MemoryPairsPlayArea level={level} onFinish={vi.fn()} />)

    // Знаходимо дві картки з однаковою фігурою, перевертаючи їх по черзі.
    const symbols = cards().map((_, index) => index)
    expect(symbols.length).toBe(12)

    press('Enter')
    press('ArrowRight')
    press('Enter')
    tick(800)

    expect(screen.getByText('Ходи: 1')).toBeInTheDocument()
  })
})
