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
  ROLE_ERROR,
  RoleError,
  ParentApprovalUnavailableError,
  setUserRole,
  listParentRequests,
  decideParentRequest,
  countPendingParentRequests,
} = await import('./admin')
const { PARENT_ERROR } = await import('./parents')

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
})

describe('зміна ролі', () => {
  it('передає серверу користувача й роль', async () => {
    rpc.mockResolvedValue({ error: null })

    await setUserRole('u1', 'parent')

    expect(rpc).toHaveBeenCalledWith('admin_set_role', { p_user_id: 'u1', p_role: 'parent' })
  })

  /**
   * Сервер відмовляє модератору, який чіпає власну роль, і інтерфейс має
   * сказати, чому, а не «спробуй ще раз»: повторна спроба нічого не змінить.
   */
  it('відмову змінити власну роль доносить як причину', async () => {
    rpc.mockResolvedValue({ error: { message: 'cannot_change_own_role' } })

    await expect(setUserRole('me', 'student')).rejects.toBeInstanceOf(RoleError)
    await expect(setUserRole('me', 'student')).rejects.toMatchObject({
      reason: ROLE_ERROR.OWN_ROLE,
    })
  })

  it('чужу помилку не видає за відому', async () => {
    const failure = { message: 'Invalid role' }
    rpc.mockResolvedValue({ error: failure })

    await expect(setUserRole('u1', 'x')).rejects.toBe(failure)
  })
})

describe('заявки батьків', () => {
  const ROW = {
    request_id: 'r1',
    created_at: '2026-10-05T09:00:00Z',
    parent_id: 'p1',
    parent_email: 'mama@example.org',
    parent_name: 'Мама',
    parent_role: 'teacher',
    parent_has_groups: false,
    student_id: 's1',
    student_name: 'Андрій',
    group_name: '6-ф',
    teacher_name: 'Олена',
    invited_by_name: 'Олена',
  }

  it('перекладає рядки сервера у форму, з якою працює панель', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null })

    await expect(listParentRequests()).resolves.toEqual([
      {
        id: 'r1',
        createdAt: '2026-10-05T09:00:00Z',
        parentId: 'p1',
        parentEmail: 'mama@example.org',
        parentName: 'Мама',
        parentRole: 'teacher',
        parentHasGroups: false,
        studentId: 's1',
        studentName: 'Андрій',
        groupName: '6-ф',
        teacherName: 'Олена',
        invitedByName: 'Олена',
      },
    ])
  })

  it('дитині без імені дає слово «Учень»', async () => {
    rpc.mockResolvedValue({ data: [{ ...ROW, student_name: null }], error: null })

    const [request] = await listParentRequests()

    expect(request.studentName).toBe('Учень')
  })

  /**
   * Міграція застосовується окремо від коду. Поки її немає, модератор має
   * почути, що саме застосувати, а не «щось пішло не так».
   */
  it('відсутню на сервері функцію відрізняє від збою', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })

    await expect(listParentRequests()).rejects.toBeInstanceOf(ParentApprovalUnavailableError)
    await expect(decideParentRequest('r1', true)).rejects.toBeInstanceOf(
      ParentApprovalUnavailableError,
    )
  })

  it('схвалення й відхилення йдуть одним викликом із різним прапорцем', async () => {
    rpc.mockResolvedValue({ error: null })

    await decideParentRequest('r1', true)
    await decideParentRequest('r2', false)

    expect(rpc).toHaveBeenNthCalledWith(1, 'admin_decide_parent_request', {
      p_request_id: 'r1',
      p_approve: true,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'admin_decide_parent_request', {
      p_request_id: 'r2',
      p_approve: false,
    })
  })

  it('заявку, яку вже розглянули, називає своїм ім’ям', async () => {
    rpc.mockResolvedValue({ error: { details: 'request_already_decided' } })

    await expect(decideParentRequest('r1', true)).rejects.toMatchObject({
      reason: PARENT_ERROR.REQUEST_ALREADY_DECIDED,
    })
  })
})

describe('лічильник заявок', () => {
  function countStub(result) {
    const eq = vi.fn(() => Promise.resolve(result))
    const select = vi.fn(() => ({ eq }))
    from.mockReturnValue({ select })
    return { select, eq }
  }

  it('рахує лише ті, що чекають, і не тягне жодного рядка', async () => {
    const { select, eq } = countStub({ count: 3, error: null })

    await expect(countPendingParentRequests()).resolves.toBe(3)

    expect(from).toHaveBeenCalledWith('parent_requests')
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(eq).toHaveBeenCalledWith('status', 'pending')
  })

  /** Без міграції таблиці немає — лічильник не має ламати шапку. */
  it('при помилці показує нуль, а не падає', async () => {
    countStub({ count: null, error: { code: 'PGRST205' } })

    await expect(countPendingParentRequests()).resolves.toBe(0)
  })
})
