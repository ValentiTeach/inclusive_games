import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import ErrorBoundary from './ErrorBoundary'

const reportError = vi.fn()
vi.mock('../../lib/errorLog', () => ({
  reportError: (...args) => reportError(...args),
}))

function Boom({ fail }) {
  if (fail) throw new Error('усе пропало')
  return <p>сторінка ціла</p>
}

describe('межа падіння', () => {
  beforeEach(() => {
    reportError.mockReset()
    // React друкує впійману помилку сам; у виводі тестів це шум.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('поки все ціле — просто показує вміст', () => {
    render(
      <ErrorBoundary>
        <Boom fail={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('сторінка ціла')).toBeTruthy()
  })

  it('замість білого екрана показує пояснення', () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Щось пішло не так/)).toBeTruthy()
  })

  /**
   * Дитина не має вирішити, що це вона щось зламала: текст прямо каже, що
   * справа не в ній, і пропонує два виходи.
   */
  it('дає дитині вихід, а не глухий кут', () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>,
    )

    expect(screen.getByText(/не через тебе/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'До каталогу ігор' })).toBeTruthy()
  })

  /**
   * Посилання звичайне, а не Link: межа має працювати й тоді, коли зламався
   * сам маршрутизатор, і всередині Router-а її тут немає взагалі.
   */
  it('вихід не залежить від маршрутизатора', () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('link', { name: 'До каталогу ігор' }).getAttribute('href')).toBe(
      '/games',
    )
  })

  it('надсилає падіння в журнал разом зі слідом компонентів', () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>,
    )

    expect(reportError).toHaveBeenCalledTimes(1)
    const [error, kind, componentStack] = reportError.mock.calls[0]
    expect(error.message).toBe('усе пропало')
    expect(kind).toBe('render')
    expect(componentStack).toContain('Boom')
  })

  /**
   * Найважливіше з усього: без скидання дитина, яка потрапила на поламану
   * сторінку, лишалася б на екрані помилки назавжди — стан межі пережив би
   * будь-який перехід, і застосунок виглядав би зламаним цілком.
   */
  it('перехід на іншу сторінку знімає екран помилки', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/games/schulte">
        <Boom fail />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    rerender(
      <ErrorBoundary resetKey="/games">
        <Boom fail={false} />
      </ErrorBoundary>,
    )

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('сторінка ціла')).toBeTruthy()
  })

  it('перемальовування тієї самої сторінки екран помилки не знімає', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/games/schulte">
        <Boom fail />
      </ErrorBoundary>,
    )

    rerender(
      <ErrorBoundary resetKey="/games/schulte">
        <Boom fail={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('після скидання наступне падіння ловиться знову', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom fail />
      </ErrorBoundary>,
    )
    rerender(
      <ErrorBoundary resetKey="/b">
        <Boom fail={false} />
      </ErrorBoundary>,
    )
    rerender(
      <ErrorBoundary resetKey="/b">
        <Boom fail />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  /**
   * Падіння в одній грі не має забирати з собою решту екрана — саме заради
   * цього межа стоїть усередині розкладки, а не навколо неї.
   */
  it('сусідній вміст поза межею лишається на екрані', () => {
    function Shell() {
      const [fail] = useState(true)
      return (
        <div>
          <nav>Навігація</nav>
          <ErrorBoundary>
            <Boom fail={fail} />
          </ErrorBoundary>
        </div>
      )
    }

    render(<Shell />)

    expect(screen.getByText('Навігація')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
