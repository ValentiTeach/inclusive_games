import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GAMES } from '../data/games'

vi.mock('../lib/authContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabaseClient', () => ({ isCloudConfigured: true, supabase: null }))

const { default: Catalog } = await import('./Catalog')

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Catalog />
    </MemoryRouter>,
  )
}

const cards = () => document.querySelectorAll('.game-card')

describe('каталог із фільтром за навиком', () => {
  it('без фільтра показує всі ігри', () => {
    renderAt('/games')

    expect(cards()).toHaveLength(GAMES.length)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Каталог ігор')
  })

  it('з навиком в адресі лишає тільки його ігри', () => {
    const memory = GAMES.filter((game) => game.category === 'memory')
    renderAt('/games?category=memory')

    expect(cards()).toHaveLength(memory.length)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Пам'ять")
  })

  /**
   * Адреса може прийти зі старої закладки або з чужого повідомлення. Порожня
   * сторінка без пояснень — найгірша з можливих відповідей на це.
   */
  it('невідомий навик показує весь каталог, а не порожнечу', () => {
    renderAt('/games?category=вигаданий')

    expect(cards()).toHaveLength(GAMES.length)
  })

  it('позначає обраний навик для читача екрана', () => {
    renderAt('/games?category=thinking')

    const current = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current'))
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '/games?category=thinking')
  })

  it('без фільтра поточний пункт — «Усі»', () => {
    renderAt('/games')

    const current = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current'))
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '/games')
  })

  // Цифра поруч із навиком — обіцянка, скільки карток відкриється.
  it('цифра у фільтрі збігається з кількістю карток', () => {
    renderAt('/games?category=attention')

    // Саме у фільтрі: позначка «Увага» є ще й на картках ігор.
    const filters = screen.getByRole('navigation', { name: 'Фільтр за навиком' })
    const link = within(filters).getByRole('link', { name: /Увага/ })
    const shown = Number(link.querySelector('.catalog-filter__count').textContent)
    expect(shown).toBe(cards().length)
  })
})
