import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
}))

const {
  PARENT_ERROR,
  PARENT_ERROR_TEXT,
  parentErrorReason,
  createParentInvite,
  redeemParentInvite,
  fetchMyChildren,
} = await import('./parents')

describe('розбір відмов сервера', () => {
  /**
   * PostgREST розкладає одну помилку Postgres по трьох полях, і яке саме поле
   * несе токен, залежить від його версії. Сервер пише токен і в MESSAGE, і в
   * DETAIL саме тому — жодне поле не має бути єдиним, на яке все спирається.
   */
  it('читає токен із будь-якого з трьох полів', () => {
    expect(parentErrorReason({ message: 'invalid_code' })).toBe(PARENT_ERROR.INVALID_CODE)
    expect(parentErrorReason({ details: 'invalid_code' })).toBe(PARENT_ERROR.INVALID_CODE)
    expect(parentErrorReason({ hint: 'invalid_code' })).toBe(PARENT_ERROR.INVALID_CODE)
  })

  it('незнайому помилку не видає за знайому', () => {
    expect(parentErrorReason({ message: 'connection reset' })).toBe(PARENT_ERROR.UNKNOWN)
    expect(parentErrorReason(null)).toBe(PARENT_ERROR.UNKNOWN)
  })

  it('кожна відмова має пояснення українською', () => {
    for (const reason of Object.values(PARENT_ERROR)) {
      expect(PARENT_ERROR_TEXT[reason]).toBeTruthy()
    }
  })
})

describe('код запрошення', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('вчитель виписує код на конкретну дитину', async () => {
    rpc.mockResolvedValue({ data: 'KRDM47XZ', error: null })

    await expect(createParentInvite('child-1')).resolves.toBe('KRDM47XZ')
    expect(rpc).toHaveBeenCalledWith('create_parent_invite', { p_student_id: 'child-1' })
  })

  it('відмову сервера доносить як причину, а не як голий текст', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_allowed' } })

    await expect(createParentInvite('child-1')).rejects.toMatchObject({
      reason: PARENT_ERROR.NOT_ALLOWED,
    })
  })

  it('уведений код повертає дитину', async () => {
    rpc.mockResolvedValue({ data: 'child-1', error: null })

    await expect(redeemParentInvite('KRDM47XZ')).resolves.toBe('child-1')
    expect(rpc).toHaveBeenCalledWith('redeem_parent_invite', { p_code: 'KRDM47XZ' })
  })

  it('використаний код відрізняє від неправильного', async () => {
    rpc.mockResolvedValue({ data: null, error: { details: 'code_already_used' } })

    await expect(redeemParentInvite('KRDM47XZ')).rejects.toMatchObject({
      reason: PARENT_ERROR.CODE_ALREADY_USED,
    })
  })
})

describe('список дітей', () => {
  function tableStub(rows) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => Promise.resolve({ data: rows, error: null }),
      then: (resolve) => resolve({ data: rows, error: null }),
    }
    return chain
  }

  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  /**
   * RLS уже обмежує вибірку власними зв'язками дорослого. Фільтр за parent_id
   * лишається навмисно: покладатися на політику як на єдиний бар'єр означало б,
   * що одна помилка в ній відкриває чужих дітей.
   */
  it('питає зв’язки саме цього дорослого', async () => {
    const eq = vi.fn(() => ({ order: () => Promise.resolve({ data: [], error: null }) }))
    from.mockReturnValue({ select: () => ({ eq }) })

    await fetchMyChildren('parent-1')

    expect(eq).toHaveBeenCalledWith('parent_id', 'parent-1')
  })

  it('без зв’язків не питає жодного профілю', async () => {
    from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    })

    await expect(fetchMyChildren('parent-1')).resolves.toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('за зв’язками дістає профілі дітей', async () => {
    from
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({ data: [{ student_id: 'child-1' }], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce(tableStub([{ id: 'child-1', display_name: 'Андрій' }]))

    await expect(fetchMyChildren('parent-1')).resolves.toEqual([
      { id: 'child-1', display_name: 'Андрій' },
    ])
  })
})
