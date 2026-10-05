import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listInactiveStudents = vi.fn()
const purgeInactiveStudents = vi.fn()
const moderatorDeleteStudent = vi.fn()

vi.mock('../../lib/retention', async (importOriginal) => ({
  ...(await importOriginal()),
  listInactiveStudents: (...args) => listInactiveStudents(...args),
  purgeInactiveStudents: (...args) => purgeInactiveStudents(...args),
  moderatorDeleteStudent: (...args) => moderatorDeleteStudent(...args),
}))

const { RetentionUnavailableError } = await import('../../lib/retention')
const { default: RetentionPanel } = await import('./RetentionPanel')

const STUDENTS = [
  { id: 's1', displayName: 'Марічка', inGroup: true, lastActivity: '2025-01-10T10:00:00Z' },
  { id: 's2', displayName: 'Остап', inGroup: false, lastActivity: '2024-11-02T10:00:00Z' },
]

beforeEach(() => {
  listInactiveStudents.mockReset()
  purgeInactiveStudents.mockReset()
  moderatorDeleteStudent.mockReset()
  vi.restoreAllMocks()
})

describe('строк зберігання в адмін-панелі', () => {
  it('спершу показує, кого зачепить, і лише потім видаляє всіх', async () => {
    const user = userEvent.setup()
    listInactiveStudents.mockResolvedValue(STUDENTS)
    purgeInactiveStudents.mockResolvedValue(2)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RetentionPanel />)

    expect(purgeInactiveStudents).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Знайти учнів/ }))

    expect(await screen.findByText('Марічка')).toBeInTheDocument()
    expect(screen.getByText('прибраний з групи')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Видалити всіх (2)' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Видалено учнів: 2.')
  })

  it('видаляє одного учня, зокрема вже прибраного з групи', async () => {
    const user = userEvent.setup()
    listInactiveStudents.mockResolvedValue(STUDENTS)
    moderatorDeleteStudent.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RetentionPanel />)

    await user.click(screen.getByRole('button', { name: /Знайти учнів/ }))
    await user.click(await screen.findByRole('button', { name: 'Видалити Остап назавжди' }))

    await waitFor(() => expect(moderatorDeleteStudent).toHaveBeenCalledWith('s2'))
    expect(screen.queryByText('Остап', { selector: 'td' })).not.toBeInTheDocument()
    expect(screen.getByText('Марічка')).toBeInTheDocument()
  })

  it('без підтвердження нічого не видаляє', async () => {
    const user = userEvent.setup()
    listInactiveStudents.mockResolvedValue(STUDENTS)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RetentionPanel />)

    await user.click(screen.getByRole('button', { name: /Знайти учнів/ }))
    await user.click(await screen.findByRole('button', { name: 'Видалити всіх (2)' }))
    expect(purgeInactiveStudents).not.toHaveBeenCalled()
  })

  it('без міграції каже, що саме треба застосувати', async () => {
    const user = userEvent.setup()
    listInactiveStudents.mockRejectedValue(new RetentionUnavailableError('missing'))
    render(<RetentionPanel />)

    await user.click(screen.getByRole('button', { name: /Знайти учнів/ }))
    expect(await screen.findByText(/20261005_data_retention\.sql/)).toBeInTheDocument()
  })
})
