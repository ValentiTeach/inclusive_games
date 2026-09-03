import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const getGroupDetails = vi.fn()
const renameStudent = vi.fn()
const removeStudentFromGroup = vi.fn()
const downloadCsv = vi.fn()

vi.mock('../lib/supabaseClient', () => ({ isCloudConfigured: true, supabase: {} }))

// One frozen object, not a fresh one per call: the page keys its load effect on
// the user, so a new identity each render would refetch on every render and
// make "how many times did we load" meaningless. AuthContext holds this in
// state, so a stable identity is what the real app provides too.
const AUTH = { user: { id: 'teacher-1' }, loading: false }
vi.mock('../lib/authContext', () => ({ useAuth: () => AUTH }))
vi.mock('../lib/groups', () => ({
  getGroupDetails: (...args) => getGroupDetails(...args),
  renameStudent: (...args) => renameStudent(...args),
  removeStudentFromGroup: (...args) => removeStudentFromGroup(...args),
}))

// Only the browser download is stubbed; the CSV itself is built by the real
// code, so this checks the wiring end to end rather than that a mock was called.
vi.mock('../lib/csv', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: (...args) => downloadCsv(...args),
}))

const { default: GroupDetail } = await import('./GroupDetail')

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupDetail />
    </MemoryRouter>,
  )
}

const group = { id: 'g1', name: '4-А клас', join_code: 'ABC123' }

describe('GroupDetail — CSV export', () => {
  beforeEach(() => {
    getGroupDetails.mockReset()
    downloadCsv.mockReset()
  })

  it('hides the export button while the group has no students', async () => {
    getGroupDetails.mockResolvedValue({ group, students: [], results: [] })
    renderPage()

    expect(await screen.findByText(/ще ніхто не приєднався/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Експортувати/ })).not.toBeInTheDocument()
  })

  it('exports every attempt with readable game titles', async () => {
    const user = userEvent.setup()
    getGroupDetails.mockResolvedValue({
      group,
      students: [
        { id: 'u1', displayName: 'Марічка', attempts: 1, avgScore: 80, joinedAt: null, lastPlayed: null },
      ],
      results: [
        {
          user_id: 'u1',
          game_id: 'stroop',
          level_id: 'easy',
          score: 80,
          played_at: '2026-03-01T10:00:00',
        },
      ],
    })

    renderPage()
    await user.click(await screen.findByRole('button', { name: /Експортувати/ }))

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled())
    const [fileName, csv] = downloadCsv.mock.calls[0]

    expect(fileName).toMatch(/^4-А-клас-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('Учень;Гра;Рівень;Бал;Дата')
    expect(csv).toContain('Марічка')
    // Resolved through the real games registry, not left as the raw id.
    expect(csv).toContain('Тест Струпа')
    expect(csv).not.toContain('stroop')
  })

  // Regression guard: getGroupDetails used not to return raw results at all.
  // If that field goes missing again the export must still produce a file
  // rather than throwing on undefined.
  it('still exports when the payload carries no results field', async () => {
    const user = userEvent.setup()
    getGroupDetails.mockResolvedValue({
      group,
      students: [
        { id: 'u1', displayName: 'Марічка', attempts: 0, avgScore: null, joinedAt: null, lastPlayed: null },
      ],
    })

    renderPage()
    await user.click(await screen.findByRole('button', { name: /Експортувати/ }))

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled())
    expect(downloadCsv.mock.calls[0][1]).toContain('Марічка')
  })
})

describe('GroupDetail — student management', () => {
  const student = {
    id: 'u1',
    displayName: 'Марічка',
    attempts: 2,
    avgScore: 70,
    joinedAt: null,
    lastPlayed: null,
  }

  beforeEach(() => {
    getGroupDetails.mockReset()
    renameStudent.mockReset()
    removeStudentFromGroup.mockReset()
    getGroupDetails.mockResolvedValue({ group, students: [student], results: [] })
  })

  it('renames a student and refreshes the table', async () => {
    const user = userEvent.setup()
    renameStudent.mockResolvedValue(undefined)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Перейменувати Марічка/ }))

    const input = screen.getByRole('textbox', { name: /Нове ім'я/ })
    await user.clear(input)
    await user.type(input, 'Марія')
    await user.click(screen.getByRole('button', { name: /Зберегти/ }))

    await waitFor(() => expect(renameStudent).toHaveBeenCalledWith('u1', 'Марія'))
    // Two loads: the initial one and the refresh after the rename.
    expect(getGroupDetails).toHaveBeenCalledTimes(2)
  })

  it('trims whitespace before sending the new name', async () => {
    const user = userEvent.setup()
    renameStudent.mockResolvedValue(undefined)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Перейменувати/ }))
    const input = screen.getByRole('textbox', { name: /Нове ім'я/ })
    await user.clear(input)
    await user.type(input, '   Марія   ')
    await user.click(screen.getByRole('button', { name: /Зберегти/ }))

    await waitFor(() => expect(renameStudent).toHaveBeenCalledWith('u1', 'Марія'))
  })

  it('cannot save an empty name', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Перейменувати/ }))
    await user.clear(screen.getByRole('textbox', { name: /Нове ім'я/ }))

    expect(screen.getByRole('button', { name: /Зберегти/ })).toBeDisabled()
    expect(renameStudent).not.toHaveBeenCalled()
  })

  it('leaves the name alone when the edit is cancelled', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Перейменувати/ }))
    expect(screen.getByRole('textbox', { name: /Нове ім'я/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Скасувати' }))

    expect(renameStudent).not.toHaveBeenCalled()
    // Back to plain text: the edit field is gone and the row is readable again.
    expect(screen.queryByRole('textbox', { name: /Нове ім'я/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Перейменувати Марічка/ })).toBeInTheDocument()
  })

  it('shows a message instead of failing silently when the rename is rejected', async () => {
    const user = userEvent.setup()
    renameStudent.mockRejectedValue(new Error('not your student'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Перейменувати/ }))
    await user.click(screen.getByRole('button', { name: /Зберегти/ }))

    expect(await screen.findByText(/Не вдалося перейменувати/)).toBeInTheDocument()
  })

  // Removing a child from a group is the kind of thing a mis-click shouldn't do.
  it('does not remove a student when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Прибрати Марічка/ }))

    expect(window.confirm).toHaveBeenCalled()
    expect(removeStudentFromGroup).not.toHaveBeenCalled()
  })

  it('removes the student once the teacher confirms', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    removeStudentFromGroup.mockResolvedValue(undefined)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Прибрати Марічка/ }))

    await waitFor(() => expect(removeStudentFromGroup).toHaveBeenCalledWith('u1'))
    expect(getGroupDetails).toHaveBeenCalledTimes(2)
  })

  it('reports a failed removal rather than pretending it worked', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    removeStudentFromGroup.mockRejectedValue(new Error('nope'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Прибрати Марічка/ }))

    expect(await screen.findByText(/Не вдалося прибрати учня/)).toBeInTheDocument()
  })
})
