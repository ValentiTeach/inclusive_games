import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
const signOut = vi.fn()

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    rpc: (...args) => rpc(...args),
    auth: { signOut: (...args) => signOut(...args) },
  },
}))

const { ACCOUNT_ERROR, deleteMyAccount, forgetSession, transferMyGroups } = await import(
  './account'
)

describe('власний акаунт', () => {
  beforeEach(() => {
    rpc.mockReset()
    signOut.mockReset()
    signOut.mockResolvedValue({ error: null })
  })

  it('відмову сервера доносить причиною, а не текстом', async () => {
    rpc.mockResolvedValue({ error: { message: 'has_groups', details: 'has_groups' } })
    await expect(deleteMyAccount()).rejects.toMatchObject({ reason: ACCOUNT_ERROR.HAS_GROUPS })

    rpc.mockResolvedValue({ error: { details: 'teacher_not_found' } })
    await expect(transferMyGroups('x@y.ua')).rejects.toMatchObject({
      reason: ACCOUNT_ERROR.TEACHER_NOT_FOUND,
    })
  })

  // Міграцію ще не застосовано — це не збій, а «дія ще не ввімкнена».
  it('без функції на сервері каже, що дія ще не ввімкнена', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'not found' } })
    await expect(deleteMyAccount()).rejects.toMatchObject({ reason: ACCOUNT_ERROR.UNAVAILABLE })
  })

  /*
   * Видалення не виходить із сеансу саме: інакше сторінка перекинула б на
   * вхід раніше, ніж встигла сказати «акаунт видалено».
   */
  it('видалення не чіпає сеансу, а forgetSession прибирає його лише тут', async () => {
    rpc.mockResolvedValue({ error: null })

    await deleteMyAccount({ deleteGroups: true })
    expect(rpc).toHaveBeenCalledWith('delete_my_account', { p_delete_groups: true })
    expect(signOut).not.toHaveBeenCalled()

    await forgetSession()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('пошту колеги передає без пробілів по краях', async () => {
    rpc.mockResolvedValue({ data: 2, error: null })
    await expect(transferMyGroups('  kolega@school.ua ')).resolves.toBe(2)
    expect(rpc).toHaveBeenCalledWith('transfer_my_groups', { p_email: 'kolega@school.ua' })
  })
})
