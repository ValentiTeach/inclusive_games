import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

describe('головна', () => {
  /*
   * Дитина приходить грати, а дорослий — зрозуміти, як почати. Кожен із трьох
   * має свій вхід, і кожен вхід веде туди, де справді можна почати.
   */
  it('має вхід для дитини, фахівця і батьків', () => {
    renderHome()

    expect(screen.getByRole('link', { name: 'Ввести код групи' })).toHaveAttribute('href', '/join')
    expect(screen.getByRole('link', { name: 'Зареєструватися' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Як отримати доступ' })).toHaveAttribute(
      'href',
      '/help#start-parent',
    )
  })

  it('каже, що це тренування, а не діагностика', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { name: 'Це тренування, а не діагностика' }),
    ).toBeInTheDocument()
  })

  it('веде до приватності й доступності просто з головної', () => {
    renderHome()
    expect(screen.getByRole('link', { name: 'Дані та приватність' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Що зроблено для доступності' })).toHaveAttribute(
      'href',
      '/accessibility',
    )
  })

  it('знімки екрана мають опис і не вантажаться наперед', () => {
    renderHome()
    for (const image of screen.getAllByRole('img')) {
      expect(image).toHaveAttribute('alt')
      expect(image.getAttribute('alt').length).toBeGreaterThan(10)
      expect(image).toHaveAttribute('loading', 'lazy')
    }
  })
})
