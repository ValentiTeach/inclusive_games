import { describe, it, expect, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import uk from './uk'
import en from './en'
import { getLocale, setLocale, translate } from './i18n'
import Home from '../pages/Home'
import Footer from '../components/layout/Footer'

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('словники', () => {
  // Ключ без перекладу показав би українське посеред англійської сторінки.
  it('кожен український ключ перекладено', () => {
    const missing = Object.keys(uk).filter((key) => !(key in en))
    expect(missing).toEqual([])
  })

  it('в англійському немає ключів, яких немає в українському', () => {
    const extra = Object.keys(en).filter((key) => !(key in uk))
    expect(extra).toEqual([])
  })

  // {count} в одній мові і {n} в іншій — порожнє місце в реченні.
  it('змінні в перекладі ті самі', () => {
    for (const key of Object.keys(uk)) {
      expect(placeholders(en[key]), key).toEqual(placeholders(uk[key]))
    }
  })

  it('порожніх перекладів немає', () => {
    for (const [key, text] of Object.entries(en)) expect(text.trim(), key).not.toBe('')
  })
})

describe('переклад', () => {
  afterEach(() => act(() => setLocale('uk')))

  it('підставляє змінні й падає на українське, коли перекладу бракує', () => {
    expect(translate('en', 'home.trust.access', { months: 12 })).toContain('12 months')
    expect(translate('en', 'no.such.key')).toBe('no.such.key')
    expect(translate('xx', 'nav.games')).toBe(uk['nav.games'])
  })

  it('перемикач у підвалі міняє мову сторінки й атрибут lang', async () => {
    render(
      <MemoryRouter>
        <Home />
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(uk['home.title'])

    act(() => setLocale('en'))

    expect(getLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Games that train attention, memory and thinking',
    )
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    expect(localStorage.getItem('inclusive-games:locale')).toBe('en')
  })

  it('невідому мову не ставить', () => {
    act(() => setLocale('xx'))
    expect(getLocale()).toBe('uk')
  })
})
