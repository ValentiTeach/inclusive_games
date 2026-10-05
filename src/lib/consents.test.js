import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = []
let response = { data: [], error: null }

function builder() {
  const chain = {
    select: (...args) => (calls.push(['select', ...args]), chain),
    in: (...args) => (calls.push(['in', ...args]), Promise.resolve(response)),
    upsert: (...args) => (calls.push(['upsert', ...args]), Promise.resolve(response)),
    delete: () => (calls.push(['delete']), chain),
    eq: (...args) => (calls.push(['eq', ...args]), Promise.resolve(response)),
  }
  return chain
}

vi.mock('./supabaseClient', () => ({
  supabase: { from: (table) => (calls.push(['from', table]), builder()) },
}))

const { clearConsent, listConsents, recordConsent } = await import('./consents')

beforeEach(() => {
  calls.length = 0
  response = { data: [], error: null }
})

describe('відмітки згоди', () => {
  it('порожня група — без запиту', async () => {
    expect(await listConsents([])).toEqual({})
    expect(calls).toEqual([])
  })

  it('повертає дату згоди для кожної дитини', async () => {
    response = { data: [{ student_id: 's1', given_on: '2026-09-01' }], error: null }
    expect(await listConsents(['s1', 's2'])).toEqual({ s1: '2026-09-01' })
    expect(calls[0]).toEqual(['from', 'parental_consents'])
  })

  it('без міграції — null, і колонка просто не з’являється', async () => {
    response = { data: null, error: { code: 'PGRST205' } }
    expect(await listConsents(['s1'])).toBeNull()
  })

  it('інша помилка не ховається', async () => {
    response = { data: null, error: { code: '42501' } }
    await expect(listConsents(['s1'])).rejects.toEqual({ code: '42501' })
  })

  it('відмітка — upsert за дитиною, з датою', async () => {
    expect(await recordConsent('s1', '2026-10-05')).toBe('2026-10-05')
    expect(calls.at(-1)).toEqual([
      'upsert',
      { student_id: 's1', given_on: '2026-10-05' },
      { onConflict: 'student_id' },
    ])
  })

  it('зняття — видалення рядка цієї дитини', async () => {
    await clearConsent('s1')
    expect(calls.slice(-2)).toEqual([['delete'], ['eq', 'student_id', 's1']])
  })
})
