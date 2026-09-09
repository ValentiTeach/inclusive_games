import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const getSessionIdentity = vi.fn()
const joinGroup = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      signOut: (...args) => signOut(...args),
    },
  },
}))

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({ refreshProfile: vi.fn() }),
}))

// JOIN_ERROR лишається справжнім: сторінка і бібліотека мають узгоджуватися на
// тих самих токенах, і підміна константи сховала б розбіжність.
vi.mock('../lib/groups', async (importOriginal) => ({
  ...(await importOriginal()),
  getSessionIdentity: (...args) => getSessionIdentity(...args),
  joinGroup: (...args) => joinGroup(...args),
}))

const { default: Join } = await import('./Join')
const { JOIN_ERROR, JoinError } = await import('../lib/groups')

function renderJoin() {
  return render(
    <MemoryRouter>
      <Join />
    </MemoryRouter>,
  )
}

const CHILD_A = {
  userId: 'child-a',
  isAnonymous: true,
  email: null,
  displayName: 'Оля Петренко',
  role: 'student',
  groupId: 'g1',
}

beforeEach(() => {
  getSessionIdentity.mockReset()
  joinGroup.mockReset().mockResolvedValue(undefined)
  signOut.mockReset().mockResolvedValue(undefined)
})

describe('Join — чистий браузер', () => {
  it('asks for a name and a code', async () => {
    getSessionIdentity.mockResolvedValue(null)
    renderJoin()

    expect(await screen.findByLabelText('Твоє ім’я')).toBeInTheDocument()
    expect(screen.getByLabelText('Код групи')).toBeInTheDocument()
  })

  // У школі зв'язок відпадає регулярно. Якщо перевірка особи впаде, дитина має
  // побачити звичайну форму, а не назавжди зависнути на «Перевіряємо…».
  it('falls back to the plain form when the identity check fails', async () => {
    getSessionIdentity.mockRejectedValue(new Error('network down'))
    renderJoin()

    expect(await screen.findByLabelText('Твоє ім’я')).toBeInTheDocument()
    expect(screen.getByLabelText('Код групи')).toBeInTheDocument()
  })

  it('joins without disturbing anything', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(null)
    renderJoin()

    await user.type(await screen.findByLabelText('Код групи'), 'ABC123')
    await user.type(screen.getByLabelText('Твоє ім’я'), 'Максим Іванчук')
    await user.click(screen.getByRole('button', { name: 'Приєднатися' }))

    await waitFor(() =>
      expect(joinGroup).toHaveBeenCalledWith('ABC123', 'Максим Іванчук', {
        startFresh: false,
      }),
    )
  })
})

describe('Join — на пристрої вже є дитина', () => {
  it('says who is on the device instead of silently reusing them', async () => {
    getSessionIdentity.mockResolvedValue(CHILD_A)
    renderJoin()

    expect(await screen.findByText('Оля Петренко')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Це не я' })).toBeInTheDocument()
  })

  // Та сама дитина повертається: імені не питаємо — вчитель міг її
  // перейменувати, і набране наосліп ім'я вже не збіглося б із профілем.
  it('lets the same child continue without retyping a name', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(CHILD_A)
    renderJoin()

    await user.type(await screen.findByLabelText('Код групи'), 'ABC123')
    expect(screen.queryByLabelText('Твоє ім’я')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Продовжити як Оля Петренко' }))

    await waitFor(() =>
      expect(joinGroup).toHaveBeenCalledWith('ABC123', 'Оля Петренко', {
        startFresh: false,
      }),
    )
  })

  /**
   * Той самий сценарій, заради якого все це робилося: комп'ютерний клас, за
   * машиною сідає друга дитина. Досі її ім'я перезаписувало профіль першої і
   * забирало собі всі її результати. Тепер вона отримує власний сеанс.
   */
  it('gives the next child their own session instead of overwriting the first', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(CHILD_A)
    renderJoin()

    await user.click(await screen.findByRole('button', { name: 'Це не я' }))

    await user.type(screen.getByLabelText('Код групи'), 'ABC123')
    await user.type(screen.getByLabelText('Твоє ім’я'), 'Максим Іванчук')
    await user.click(screen.getByRole('button', { name: 'Приєднатися' }))

    await waitFor(() =>
      expect(joinGroup).toHaveBeenCalledWith('ABC123', 'Максим Іванчук', {
        startFresh: true,
      }),
    )
  })

  it('promises the first child that her results stay hers', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(CHILD_A)
    renderJoin()

    await user.click(await screen.findByRole('button', { name: 'Це не я' }))

    expect(screen.getByText(/результати нікуди не зникнуть/i)).toBeInTheDocument()
  })
})

describe('Join — відмови сервера', () => {
  // Сторінка могла не знати про чужий профіль (стара вкладка, перейменування).
  // Тоді відмова сервера має відкрити поле імені, а не залишити глухий кут.
  it('recovers from a refusal by offering the fresh-session path', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(CHILD_A)
    joinGroup.mockRejectedValueOnce(new JoinError(JOIN_ERROR.SESSION_BELONGS_TO_OTHER))
    renderJoin()

    await user.type(await screen.findByLabelText('Код групи'), 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Продовжити як Оля Петренко' }))

    expect(await screen.findByText(/належить іншій дитині/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Твоє ім’я')).toBeInTheDocument()
  })

  it.each([
    [JOIN_ERROR.INVALID_CODE, /Такої групи немає/i],
    [JOIN_ERROR.NAME_TOO_LONG, /задовге/i],
    [JOIN_ERROR.NOT_A_STUDENT, /вчительський акаунт/i],
  ])('explains %s in its own words', async (reason, expected) => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue(null)
    joinGroup.mockRejectedValueOnce(new JoinError(reason))
    renderJoin()

    await user.type(await screen.findByLabelText('Код групи'), 'ABC123')
    await user.type(screen.getByLabelText('Твоє ім’я'), 'Максим')
    await user.click(screen.getByRole('button', { name: 'Приєднатися' }))

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
})

describe('Join — на пристрої вчитель', () => {
  it('does not offer a code form to an email account', async () => {
    getSessionIdentity.mockResolvedValue({
      userId: 'teacher-1',
      isAnonymous: false,
      email: 'teacher@school.ua',
      displayName: 'Вчителька',
      role: 'teacher',
      groupId: null,
    })
    renderJoin()

    expect(await screen.findByText('teacher@school.ua')).toBeInTheDocument()
    expect(screen.queryByLabelText('Код групи')).not.toBeInTheDocument()
  })

  it('offers to sign out so the child can join', async () => {
    const user = userEvent.setup()
    getSessionIdentity.mockResolvedValue({
      userId: 'teacher-1',
      isAnonymous: false,
      email: 'teacher@school.ua',
      displayName: 'Вчителька',
      role: 'teacher',
      groupId: null,
    })
    renderJoin()

    await user.click(
      await screen.findByRole('button', { name: 'Вийти й приєднатися як учень' }),
    )

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(await screen.findByLabelText('Твоє ім’я')).toBeInTheDocument()
  })
})
