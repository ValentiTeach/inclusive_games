import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Privacy from './Privacy'
import Consent from './Consent'

function renderAt(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('Дані та приватність', () => {
  it('називає строк зберігання, а не «автоматичного видалення немає»', () => {
    renderAt(<Privacy />)
    expect(screen.getByText('12 місяців')).toBeInTheDocument()
    expect(screen.queryByText(/Автоматичного\s+видалення поки немає/)).not.toBeInTheDocument()
  })

  it('веде до бланка згоди і описує права батьків', () => {
    renderAt(<Privacy />)
    expect(screen.getByRole('link', { name: /бланк згоди для друку/ })).toHaveAttribute('href', '/privacy/consent')
    expect(screen.getByRole('heading', { name: 'Права батьків' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Куди звертатися' })).toBeInTheDocument()
  })
})

describe('службові дані на сторінці приватності', () => {
  it('називає строки журналу помилок і відгуків і захист від підбору кодів', () => {
    renderAt(<Privacy />)
    expect(screen.getByText(/видаляються через 90 днів/)).toBeInTheDocument()
    expect(screen.getByText('Відгуки')).toBeInTheDocument()
    expect(screen.getByText('Захист від підбору кодів')).toBeInTheDocument()
  })

  it('каже дорослому, як видалити власний акаунт', () => {
    renderAt(<Privacy />)
    expect(screen.getByRole('heading', { name: 'Акаунт дорослого' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '«Акаунт»' })).toHaveAttribute('href', '/account')
  })
})

describe('бланк згоди', () => {
  it('має все, що батьки мають знати до підпису', () => {
    renderAt(<Consent />)
    for (const heading of ['1. Навіщо', '2. Що зберігається', '3. Хто бачить', '4. Скільки зберігається', '5. Ваші права', '6. Рішення']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/12 місяців не грала/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Друкувати бланк' })).toBeInTheDocument()
  })
})
