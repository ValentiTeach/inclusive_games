import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GameBreakdown from './GameBreakdown'

const STUDENTS = [
  { id: 'a', displayName: 'Аня' },
  { id: 'b', displayName: 'Богдан' },
  { id: 'c', displayName: 'Віра' },
]

const RESULTS = [
  {
    user_id: 'a',
    game_id: 'schulte',
    score: 80,
    played_at: '2026-09-10T10:00:00Z',
    metrics: { total: 25, accuracy_pct: 92, avg_rt_ms: 700, rt_count: 25, grid_size: 5 },
  },
  {
    user_id: 'b',
    game_id: 'schulte',
    score: 35,
    played_at: '2026-09-11T10:00:00Z',
    // Коротша спроба: п'ять проб проти двадцяти п'яти в Ані.
    metrics: { total: 5, accuracy_pct: 48, avg_rt_ms: 1400, rt_count: 5, grid_size: 5 },
  },
  {
    user_id: 'a',
    game_id: 'digit-span',
    score: 60,
    played_at: '2026-09-09T10:00:00Z',
    metrics: { total: 6, correct: 4, accuracy_pct: 67, span: 5 },
  },
]

function renderBreakdown(results = RESULTS, students = STUDENTS) {
  render(<GameBreakdown results={results} students={students} />)
}

describe('зріз за іграми', () => {
  it('показує рядок на кожну зіграну гру', () => {
    renderBreakdown()

    expect(screen.getByText('Таблиці Шульте')).toBeInTheDocument()
    expect(screen.getByText('Послідовність цифр')).toBeInTheDocument()
  })

  /**
   * Сенс усієї роботи: показники, які дев'ятнадцять ігор пишуть у базу, досі не
   * мали виходу в інтерфейс.
   */
  it('виносить точність і час реакції прямо в таблицю', () => {
    renderBreakdown()
    const row = screen.getByText('Таблиці Шульте').closest('tr')

    /*
     * Спроби різної довжини, і це навмисно: зважене середнє дає 85% і 817 мс,
     * просте середнє від середніх — 70% і 1050 мс. Якби таблиця показувала
     * друге, коротка спроба тягнула б показник класу нарівні з довгою.
     */
    expect(within(row).getByText('85%')).toBeInTheDocument()
    expect(within(row).getByText('817 мс')).toBeInTheDocument()
  })

  it('каже, скільки дітей грали, а не лише скільки спроб', () => {
    renderBreakdown()
    const row = screen.getByText('Таблиці Шульте').closest('tr')

    expect(within(row).getByText('2 з 3')).toBeInTheDocument()
  })

  it('спершу рядки згорнуті — учнів не видно', () => {
    renderBreakdown()

    expect(screen.queryByText('Богдан')).not.toBeInTheDocument()
  })

  it('розгортає гру і показує кожного учня', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Таблиці Шульте'))

    expect(screen.getByText('Аня')).toBeInTheDocument()
    expect(screen.getByText('Богдан')).toBeInTheDocument()
  })

  /**
   * Учитель шукає, кому потрібна допомога. Найслабший має бути першим, а не
   * загубленим у кінці списку.
   */
  it('найслабший учень стоїть першим', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Таблиці Шульте'))

    const names = [...document.querySelectorAll('.breakdown__student-name')].map(
      (node) => node.textContent,
    )
    expect(names).toEqual(['Богдан', 'Аня'])
  })

  /**
   * «Не грав» і «зіграв погано» — різні речі. Порожнє місце теж відповідь, і
   * вчителю треба бачити, кого просто не було.
   */
  it('називає тих, хто ще не грав у цю гру', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Таблиці Шульте'))

    expect(screen.getByText(/Ще не грали: Віра/)).toBeInTheDocument()
  })

  it('показує показники, специфічні для гри, у розгорнутому вигляді', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Послідовність цифр'))

    expect(screen.getByText('Обсяг пам’яті')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('розкрита може бути лише одна гра', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Таблиці Шульте'))
    await user.click(screen.getByText('Послідовність цифр'))

    expect(screen.queryByText('Богдан')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.breakdown__details')).toHaveLength(1)
  })

  /**
   * rt_count існує тільки для чесного зважування середнього — це бухгалтерія
   * розрахунку, а не результат дитини.
   */
  it('не показує вчителю службових показників', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByText('Таблиці Шульте'))

    expect(screen.queryByText(/Проб із часом/i)).not.toBeInTheDocument()
  })

  it('без жодної спроби пояснює, що тут буде', () => {
    renderBreakdown([])

    expect(screen.getByText(/зріз за іграми/i)).toBeInTheDocument()
    expect(document.querySelector('.breakdown__table')).toBeNull()
  })
})
