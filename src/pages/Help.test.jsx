import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Help from './Help'
import Accessibility from './Accessibility'
import { METRIC_LABELS } from '../games/engine/metrics'

function renderAt(page, path = '/help') {
  return render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>)
}

describe('довідка', () => {
  /*
   * «?» у звіті веде на /help#metric-<ключ>. Якщо якоря немає, людина
   * опиняється на початку довгої сторінки без пояснення, заради якого прийшла.
   */
  it('кожен показник має свій якір', () => {
    renderAt(<Help />)
    for (const key of Object.keys(METRIC_LABELS)) {
      if (key === 'rt_count') continue
      expect(document.getElementById(`metric-${key}`), key).not.toBeNull()
    }
  })

  it('виділяє показник, до якого прийшли зі звіту', () => {
    renderAt(<Help />, '/help#metric-rt_cv_pct')
    expect(document.getElementById('metric-rt_cv_pct')).toHaveClass('is-target')
    expect(document.querySelectorAll('.is-target')).toHaveLength(1)
  })

  it('зміст веде до кожного розділу', () => {
    renderAt(<Help />)
    const toc = screen.getByRole('navigation', { name: 'Зміст' })
    for (const link of toc.querySelectorAll('a')) {
      const id = link.getAttribute('href').slice(1)
      expect(document.getElementById(id), id).not.toBeNull()
    }
  })

  it('чесно каже, що це не діагностика', () => {
    renderAt(<Help />)
    expect(screen.getByRole('heading', { name: 'Це тренування, а не діагностика' })).toBeInTheDocument()
    expect(screen.getByText(/не є діагнозом/)).toBeInTheDocument()
  })
})

describe('доступність', () => {
  it('каже і що зроблено, і чого бракує, і куди писати', () => {
    renderAt(<Accessibility />, '/accessibility')
    expect(screen.getByRole('heading', { name: 'Що вже є' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Чого ще бракує' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'напишіть нам' })).toHaveAttribute(
      'href',
      '/feedback?kind=accessibility',
    )
  })
})
