import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const signInWithOtp = vi.fn()

vi.mock('../lib/supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    auth: {
      signInWithOtp: (...args) => signInWithOtp(...args),
      getUser: vi.fn(),
    },
  },
}))

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({ user: null, loading: false, refreshProfile: vi.fn() }),
}))

vi.mock('../lib/groups', () => ({ joinGroup: vi.fn() }))

const { default: Login } = await import('./Login')

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

async function openTeacherPanel(user) {
  await user.click(screen.getByText('Я вчитель / психолог'))
}

describe('Login — teacher email panel', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
  })

  it('defaults to the sign-in tab, not registration', async () => {
    const user = userEvent.setup()
    renderLogin()
    await openTeacherPanel(user)

    expect(screen.getByRole('tab', { name: 'Вхід' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Реєстрація' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('signs in without creating an account for an unknown email', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({ error: null })
    renderLogin()
    await openTeacherPanel(user)

    await user.type(screen.getByLabelText('Електронна пошта'), 'teacher@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання для входу' }))

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false)
  })

  it('creates the account and passes the name when registering', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({ error: null })
    renderLogin()
    await openTeacherPanel(user)
    await user.click(screen.getByRole('tab', { name: 'Реєстрація' }))

    await user.type(screen.getByLabelText("Ім'я"), '  Валентин  ')
    await user.type(screen.getByLabelText('Електронна пошта'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Зареєструватися' }))

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    const options = signInWithOtp.mock.calls[0][0].options
    expect(options.shouldCreateUser).toBe(true)
    expect(options.data).toEqual({ display_name: 'Валентин' })
  })

  // Regression: a rate-limited sign-in used to be reported as "account not
  // found", which sent the user off to register an account they already had.
  it('reports a rate limit as a rate limit, not as a missing account', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({
      error: { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    })
    renderLogin()
    await openTeacherPanel(user)

    await user.type(screen.getByLabelText('Електронна пошта'), 'teacher@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання для входу' }))

    expect(await screen.findByText(/Забагато спроб/)).toBeInTheDocument()
    expect(screen.queryByText(/не знайдено/)).not.toBeInTheDocument()
  })

  it('points an unknown email at the registration tab', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({ error: { status: 400, message: 'Signups not allowed for otp' } })
    renderLogin()
    await openTeacherPanel(user)

    await user.type(screen.getByLabelText('Електронна пошта'), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання для входу' }))

    expect(await screen.findByText(/не знайдено/)).toBeInTheDocument()
  })

  // Regression: unexpected failures used to be swallowed behind a generic
  // message, which cost an hour of guessing at what Supabase was rejecting.
  it('surfaces the raw provider message for unexpected failures', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({ error: { status: 500, message: 'Database connection failed' } })
    renderLogin()
    await openTeacherPanel(user)

    await user.type(screen.getByLabelText('Електронна пошта'), 'teacher@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання для входу' }))

    expect(await screen.findByText(/Database connection failed/)).toBeInTheDocument()
  })

  it('confirms the mail was sent instead of leaving the form up', async () => {
    const user = userEvent.setup()
    signInWithOtp.mockResolvedValue({ error: null })
    renderLogin()
    await openTeacherPanel(user)

    await user.type(screen.getByLabelText('Електронна пошта'), 'teacher@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання для входу' }))

    expect(await screen.findByText(/Перевір пошту/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Електронна пошта')).not.toBeInTheDocument()
  })
})
