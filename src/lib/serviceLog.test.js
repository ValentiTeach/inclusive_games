import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    from: () => ({ insert: (...args) => insert(...args) }),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))

const { groupErrors, sendFeedback, FEEDBACK_ERROR, FEEDBACK_MAX } = await import('./serviceLog')

function row(id, message, occurredAt, extra = {}) {
  return { id, kind: 'render', message, occurred_at: occurredAt, ...extra }
}

describe('групування журналу падінь', () => {
  /*
   * Рядки приходять від найновіших. Група має знати і скільки разів, і коли
   * востаннє, і на яких сторінках та версіях — заради цього вона й існує.
   */
  it('збирає однакові падіння в одну групу з лічильником', () => {
    const groups = groupErrors([
      row(3, 'зламалося', '2026-10-12T10:00:00Z', { path: '/games', build: 'b2', user_id: 'a' }),
      row(2, 'інше', '2026-10-11T10:00:00Z'),
      row(1, 'зламалося', '2026-10-10T10:00:00Z', { path: '/progress', build: 'b1', user_id: 'b' }),
      row(0, 'зламалося', '2026-10-09T10:00:00Z', { path: '/games', build: 'b1', user_id: 'a' }),
    ])

    expect(groups).toHaveLength(2)
    const [top] = groups
    expect(top.message).toBe('зламалося')
    expect(top.count).toBe(3)
    expect(top.lastAt).toBe('2026-10-12T10:00:00Z')
    expect(top.firstAt).toBe('2026-10-09T10:00:00Z')
    expect(top.paths).toEqual(['/games', '/progress'])
    expect(top.builds).toEqual(['b2', 'b1'])
    expect(top.users).toBe(2)
    expect(top.latest.id).toBe(3)
  })

  // Той самий текст з різних місць — та сама історія, а різний вид — ні.
  it('розрізняє вид падіння', () => {
    const groups = groupErrors([
      row(1, 'x', '2026-10-12T10:00:00Z'),
      { ...row(2, 'x', '2026-10-12T09:00:00Z'), kind: 'promise' },
    ])
    expect(groups).toHaveLength(2)
  })

  it('за рівного лічильника вище — свіжіше', () => {
    const groups = groupErrors([
      row(1, 'старе', '2026-10-01T10:00:00Z'),
      row(2, 'нове', '2026-10-12T10:00:00Z'),
    ])
    expect(groups.map((group) => group.message)).toEqual(['нове', 'старе'])
  })
})

describe('відгук', () => {
  beforeEach(() => {
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
  })

  it('порожній не надсилає', async () => {
    await expect(sendFeedback({ kind: 'idea', message: '   ' })).rejects.toMatchObject({
      reason: FEEDBACK_ERROR.EMPTY,
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('підписує користувачем, сторінкою й версією, обрізає задовге', async () => {
    await sendFeedback({
      kind: 'problem',
      message: 'а'.repeat(FEEDBACK_MAX + 50),
      contact: '  mama@example.com ',
      fromPath: '/games/stroop',
    })

    const sent = insert.mock.calls[0][0]
    expect(sent.user_id).toBe('u1')
    expect(sent.kind).toBe('problem')
    expect(sent.message).toHaveLength(FEEDBACK_MAX)
    expect(sent.contact).toBe('mama@example.com')
    expect(sent.path).toBe('/games/stroop')
    expect(sent.build).toBeTruthy()
  })

  it('невідомий вид стає «інше», порожній контакт — null', async () => {
    await sendFeedback({ kind: 'hack', message: 'привіт', contact: ' ' })

    const sent = insert.mock.calls[0][0]
    expect(sent.kind).toBe('other')
    expect(sent.contact).toBeNull()
  })

  it('ліміт сервера відрізняє від збою', async () => {
    insert.mockResolvedValue({ error: { code: 'P0001', message: 'too_many_attempts' } })
    await expect(sendFeedback({ kind: 'idea', message: 'ще' })).rejects.toMatchObject({
      reason: FEEDBACK_ERROR.TOO_MANY,
    })
  })

  it('без таблиці каже, що форма ще не ввімкнена', async () => {
    insert.mockResolvedValue({ error: { code: 'PGRST205', message: 'no table' } })
    await expect(sendFeedback({ kind: 'idea', message: 'ще' })).rejects.toMatchObject({
      reason: FEEDBACK_ERROR.UNAVAILABLE,
    })
  })
})
