import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = { user: null, profile: null, loading: false }

vi.mock('../../lib/authContext', () => ({ useAuth: () => auth }))

const { default: Header } = await import('./Header')

function renderAs(role, { signedIn = true } = {}) {
  auth.user = signedIn ? { id: 'u1', email: 'teacher@example.com' } : null
  auth.profile = role ? { display_name: 'Хтось', role } : null

  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  )

  return screen.getByRole('navigation', { name: 'Основна навігація' })
}

function header() {
  return document.querySelector('.site-header')
}

function linkNames(nav) {
  return [...nav.querySelectorAll('a')].map((link) => link.textContent.trim())
}

describe('навігація за роллю', () => {
  /**
   * «Мої групи» — робочий екран вчителя, і донедавна меню про нього мовчало:
   * потрапити туди можна було лише через сторінку акаунта.
   */
  it('веде вчителя до його груп', () => {
    const nav = renderAs('teacher')

    expect(screen.getByRole('link', { name: /Мої групи/ })).toHaveAttribute('href', '/groups')
    expect(linkNames(nav)).not.toContain('Адмінка')
  })

  it('дає модератору і групи, і адмінку', () => {
    renderAs('moderator')

    expect(screen.getByRole('link', { name: /Мої групи/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Адмінка/ })).toHaveAttribute('href', '/admin')
  })

  /**
   * Учневі ці сторінки не належать. Показати їх означало б вести дитину до
   * відмови в доступі — меню має обіцяти лише те, що справді відкриється.
   */
  it('не показує учневі чужі сторінки', () => {
    const nav = renderAs('student')
    const names = linkNames(nav)

    expect(names).not.toContain('Мої групи')
    expect(names).not.toContain('Адмінка')
    // Але звичайні пункти в нього є — фільтр прибирає саме зайве.
    expect(names).toContain('Каталог ігор')
  })

  it('не показує їх і гостю без профілю', () => {
    const nav = renderAs(null, { signedIn: false })
    const names = linkNames(nav)

    expect(names).not.toContain('Мої групи')
    expect(names).not.toContain('Адмінка')
    expect(names).toContain('Увійти')
  })
})

/**
 * Скільки пунктів поміститься в один ряд, залежить не від ширини екрана, а від
 * того, скільки їх узагалі. Тому клас щільності ставиться тут, а не в CSS:
 * медіазапит не вміє рахувати елементи. Виміряно: сім пунктів модератора з
 * підписами потребують 996 px при доступних 954 — без цього класу шапка
 * ламалася на два ряди на кожній ширині.
 */
describe('щільність шапки', () => {
  it('позначає шапку щільною, коли додались рольові пункти', () => {
    renderAs('teacher')

    expect(header().className).toContain('site-header--dense')
  })

  it('не позначає шапку учня', () => {
    renderAs('student')

    expect(header().className).not.toContain('site-header--dense')
  })
})

describe('підпис акаунта', () => {
  /**
   * Пошта — це логін, а не те, як учителька себе називає. У меню вона ще й
   * коштувала близько 180 px: саме через неї шапка з рольовими пунктами не
   * вміщалася в один ряд. Повна адреса лишається в title і на сторінці акаунта.
   */
  it('показує імʼя, а не пошту', () => {
    renderAs('teacher')

    const account = screen.getByRole('link', { name: /Хтось/ })
    expect(account).toHaveTextContent('Хтось')
    expect(account).not.toHaveTextContent('teacher@example.com')
    expect(account.querySelector('[title]')).toHaveAttribute('title', 'Хтось')
  })

  it('падає назад на пошту, поки профіль не завантажився', () => {
    auth.user = { id: 'u1', email: 'teacher@example.com' }
    auth.profile = null
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /teacher@example.com/ })).toBeInTheDocument()
  })
})
