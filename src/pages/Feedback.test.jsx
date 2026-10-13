import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const sendFeedback = vi.fn()

vi.mock('../lib/supabaseClient', () => ({ isCloudConfigured: true, supabase: {} }))
vi.mock('../lib/serviceLog', async (importOriginal) => ({
  ...(await importOriginal()),
  sendFeedback: (...args) => sendFeedback(...args),
}))

const { default: Feedback } = await import('./Feedback')
const { FeedbackError, FEEDBACK_ERROR } = await import('../lib/serviceLog')

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Feedback />
    </MemoryRouter>,
  )
}

describe('форма відгуку', () => {
  beforeEach(() => {
    sendFeedback.mockReset()
    sendFeedback.mockResolvedValue(undefined)
  })

  it('надсилає вид, текст, контакт і сторінку, з якої прийшли', async () => {
    const user = userEvent.setup()
    renderAt({ pathname: '/feedback', state: { from: '/games/stroop' } })

    await user.click(screen.getByRole('radio', { name: 'Ідея чи побажання' }))
    await user.type(screen.getByLabelText(/Що сталося/), 'Додайте гру на рими')
    await user.type(screen.getByLabelText(/Пошта чи телефон/), 'mama@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати' }))

    expect(sendFeedback).toHaveBeenCalledWith({
      kind: 'idea',
      message: 'Додайте гру на рими',
      contact: 'mama@example.com',
      fromPath: '/games/stroop',
    })
    expect(await screen.findByRole('heading', { name: 'Дякуємо!' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('відповімо')
  })

  // Зі сторінки «Доступність» форма відкривається вже з потрібним видом.
  it('бере вид із адреси', () => {
    renderAt('/feedback?kind=accessibility')
    expect(screen.getByRole('radio', { name: 'Доступність' })).toBeChecked()
  })

  it('невідомий вид з адреси не підставляє', () => {
    renderAt('/feedback?kind=hack')
    expect(screen.getByRole('radio', { name: 'Щось не працює' })).toBeChecked()
  })

  it('порожнє повідомлення не відправляє', () => {
    renderAt('/feedback')
    expect(screen.getByRole('button', { name: 'Надіслати' })).toBeDisabled()
  })

  it('ліміт пояснює словами й лишає текст на місці', async () => {
    sendFeedback.mockRejectedValue(new FeedbackError(FEEDBACK_ERROR.TOO_MANY))
    const user = userEvent.setup()
    renderAt('/feedback')

    await user.type(screen.getByLabelText(/Що сталося/), 'Знову не працює')
    await user.click(screen.getByRole('button', { name: 'Надіслати' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('кілька повідомлень за годину')
    expect(screen.getByLabelText(/Що сталося/)).toHaveValue('Знову не працює')
  })
})
