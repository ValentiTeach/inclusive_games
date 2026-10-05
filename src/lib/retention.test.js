import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('./supabaseClient', () => ({ supabase: { rpc: (...args) => rpc(...args) } }))

const {
  RETENTION_MONTHS,
  RetentionUnavailableError,
  isPastRetention,
  lastActivity,
  listInactiveStudents,
  moderatorDeleteStudent,
  purgeInactiveStudents,
  retentionCutoff,
} = await import('./retention')

const NOW = new Date('2026-10-05T12:00:00Z')

describe('строк зберігання', () => {
  it('дванадцять місяців — те саме число, що обіцяє /privacy і сервер', () => {
    expect(RETENTION_MONTHS).toBe(12)
  })

  it('остання активність — пізніше з приєднання й останньої гри', () => {
    expect(lastActivity({ joinedAt: '2025-01-01T00:00:00Z', lastPlayed: '2025-06-01T00:00:00Z' })).toBe(
      '2025-06-01T00:00:00Z',
    )
    expect(lastActivity({ joinedAt: '2025-01-01T00:00:00Z', lastPlayed: null })).toBe('2025-01-01T00:00:00Z')
    expect(lastActivity({})).toBeNull()
  })

  it('межа — календарні місяці назад', () => {
    expect(retentionCutoff(NOW).toISOString()).toBe('2025-10-05T12:00:00.000Z')
  })

  it('понад рік без гри — за строком', () => {
    expect(
      isPastRetention({ joinedAt: '2024-09-01T00:00:00Z', lastPlayed: '2025-09-30T00:00:00Z' }, NOW),
    ).toBe(true)
  })

  it('недавня гра рятує давнє приєднання', () => {
    expect(
      isPastRetention({ joinedAt: '2023-09-01T00:00:00Z', lastPlayed: '2026-09-30T00:00:00Z' }, NOW),
    ).toBe(false)
  })

  it('дитина, що щойно приєдналася й ще не грала, — не за строком', () => {
    expect(isPastRetention({ joinedAt: '2026-10-01T00:00:00Z', lastPlayed: null }, NOW)).toBe(false)
  })
})

describe('сервер', () => {
  beforeEach(() => rpc.mockReset())

  it('список неактивних перекладається в імена полів сторінки', async () => {
    rpc.mockResolvedValue({
      data: [{ student_id: 's1', display_name: null, group_id: null, last_activity: '2025-01-01' }],
      error: null,
    })
    expect(await listInactiveStudents()).toEqual([
      { id: 's1', displayName: 'Учень', inGroup: false, lastActivity: '2025-01-01' },
    ])
    expect(rpc).toHaveBeenCalledWith('inactive_students', { p_months: 12 })
  })

  it('очищення повертає, скільки видалено', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })
    expect(await purgeInactiveStudents()).toBe(3)
    expect(rpc).toHaveBeenCalledWith('purge_inactive_students', { p_months: 12 })
  })

  it('без міграції — окрема помилка, а не «щось пішло не так»', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    await expect(moderatorDeleteStudent('s1')).rejects.toBeInstanceOf(RetentionUnavailableError)
  })

  it('інші помилки летять як є', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'nope' } })
    await expect(purgeInactiveStudents()).rejects.not.toBeInstanceOf(RetentionUnavailableError)
  })
})
