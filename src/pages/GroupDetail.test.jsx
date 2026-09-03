import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const getGroupDetails = vi.fn()
const downloadCsv = vi.fn()

vi.mock('../lib/supabaseClient', () => ({ isCloudConfigured: true, supabase: {} }))
vi.mock('../lib/authContext', () => ({
  useAuth: () => ({ user: { id: 'teacher-1' }, loading: false }),
}))
vi.mock('../lib/groups', () => ({ getGroupDetails: (...args) => getGroupDetails(...args) }))

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
