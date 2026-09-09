import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveResult, getResults } from '../games/engine/storage'

const mocks = vi.hoisted(() => ({
  calls: [],
  session: null,
  profileRow: null,
  rpcResult: { error: null },
  rpcArgs: null,
}))

// Скільки локальних спроб лежить у браузері прямо зараз. Саме це число
// migrateLocalHistoryOnce залив би в хмару під новим акаунтом, тож воно
// фіксується в момент входу, а не після нього.
function countLocalResults() {
  return ['stroop', 'schulte'].reduce((sum, id) => sum + getResults(id).length, 0)
}

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mocks.session } }),
      signOut: async () => {
        mocks.calls.push('signOut')
        mocks.session = null
      },
      signInAnonymously: async () => {
        mocks.calls.push(`signIn(localResults=${countLocalResults()})`)
        mocks.session = { user: { id: 'fresh-user', is_anonymous: true } }
        return { error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.profileRow }) }),
      }),
    }),
    rpc: async (name, args) => {
      mocks.calls.push(`rpc:${name}`)
      mocks.rpcArgs = args
      return mocks.rpcResult
    },
  },
}))

const {
  JOIN_ERROR,
  getSessionIdentity,
  isSameStudent,
  joinErrorReason,
  joinGroup,
  normalizeStudentName,
  startFreshStudentSession,
} = await import('./groups')

beforeEach(() => {
  mocks.calls = []
  mocks.session = null
  mocks.profileRow = null
  mocks.rpcResult = { error: null }
  mocks.rpcArgs = null
  localStorage.clear()
})

describe('joinErrorReason', () => {
  // PostgREST кладе одну й ту саму помилку в різні поля залежно від версії,
  // тому кожне з них має спрацьовувати самостійно.
  it.each([
    ['details', { details: 'session_belongs_to_other' }],
    ['message', { message: 'session_belongs_to_other' }],
    ['hint', { hint: 'session_belongs_to_other' }],
  ])('reads the token out of %s', (_field, error) => {
    expect(joinErrorReason(error)).toBe(JOIN_ERROR.SESSION_BELONGS_TO_OTHER)
  })

  it('falls back to unknown for an error it has never seen', () => {
    expect(joinErrorReason({ message: 'connection reset' })).toBe(JOIN_ERROR.UNKNOWN)
  })

  it('survives an error object with nothing in it', () => {
    expect(joinErrorReason(null)).toBe(JOIN_ERROR.UNKNOWN)
  })
})

describe('normalizeStudentName / isSameStudent', () => {
  it('matches the same child through spacing and capitalisation', () => {
    expect(isSameStudent('Оля  Петренко', ' оля петренко ')).toBe(true)
  })

  it('does not match two different children', () => {
    expect(isSameStudent('Оля Петренко', 'Максим Іванчук')).toBe(false)
  })

  // Порожнє ім'я не є нічиїм іменем: інакше профіль без імені збігався б
  // із будь-яким порожнім полем і пропускав чужу дитину в чужий сеанс.
  it('treats an empty name as nobody', () => {
    expect(isSameStudent('', '')).toBe(false)
    expect(isSameStudent('   ', '')).toBe(false)
  })

  it('collapses the same whitespace the server collapses', () => {
    expect(normalizeStudentName('  Оля\t\tПетренко  ')).toBe('Оля Петренко')
  })
})

describe('startFreshStudentSession — передача комп\'ютера', () => {
  it('ends the previous session before opening a new one', async () => {
    mocks.session = { user: { id: 'child-a', is_anonymous: true } }

    await startFreshStudentSession()

    expect(mocks.calls[0]).toBe('signOut')
    expect(mocks.calls[1]).toMatch(/^signIn/)
  })

  /**
   * Головний регресійний тест. Локальна історія лежить на браузері, не на
   * дитині, а migrateLocalHistoryOnce спрацьовує на подію входу і має прапорець
   * за user_id. Якщо очищення переставити після signInAnonymously, спроби
   * першої дитини поїдуть у хмару як спроби другої — тихо і без помилки.
   */
  it('clears the previous child\'s local history before the new sign-in', async () => {
    saveResult('stroop', { score: 90, entries: [], levelId: 1 })
    saveResult('schulte', { score: 70, entries: [], levelId: 1 })
    expect(countLocalResults()).toBe(2)

    await startFreshStudentSession()

    expect(mocks.calls).toContain('signIn(localResults=0)')
    expect(countLocalResults()).toBe(0)
  })
})

describe('joinGroup', () => {
  it('starts a fresh session when the child says "this is not me"', async () => {
    mocks.session = { user: { id: 'child-a', is_anonymous: true } }

    await joinGroup('abc123', 'Максим Іванчук', { startFresh: true })

    expect(mocks.calls).toEqual([
      'signOut',
      'signIn(localResults=0)',
      'rpc:join_group',
    ])
  })

  // Дитина повертається до власного пристрою — новий акаунт тут створив би
  // дубль у списку вчителя і розірвав би її історію надвоє.
  it('reuses the session when the same child comes back', async () => {
    mocks.session = { user: { id: 'child-a', is_anonymous: true } }

    await joinGroup('abc123', 'Оля Петренко')

    expect(mocks.calls).toEqual(['rpc:join_group'])
  })

  it('signs in anonymously when there is no session at all', async () => {
    await joinGroup('abc123', 'Оля Петренко')

    expect(mocks.calls).toEqual(['signIn(localResults=0)', 'rpc:join_group'])
  })

  it('normalises the code and the name it sends', async () => {
    await joinGroup('  abc123 ', '  Оля   Петренко ')

    expect(mocks.rpcArgs).toEqual({
      p_code: 'ABC123',
      p_display_name: 'Оля Петренко',
    })
  })

  it('surfaces the server refusal as a reason the page can act on', async () => {
    mocks.rpcResult = { error: { message: 'session_belongs_to_other' } }

    await expect(joinGroup('ABC123', 'Максим')).rejects.toMatchObject({
      reason: JOIN_ERROR.SESSION_BELONGS_TO_OTHER,
    })
  })
})

describe('getSessionIdentity', () => {
  it('reports nobody when the browser has no session', async () => {
    expect(await getSessionIdentity()).toBeNull()
  })

  it('reports the child currently on the device', async () => {
    mocks.session = { user: { id: 'child-a', is_anonymous: true, email: null } }
    mocks.profileRow = { display_name: 'Оля Петренко', role: 'student', group_id: 'g1' }

    expect(await getSessionIdentity()).toEqual({
      userId: 'child-a',
      isAnonymous: true,
      email: null,
      displayName: 'Оля Петренко',
      role: 'student',
      groupId: 'g1',
    })
  })

  it('marks an email account as not anonymous, so the page can say so', async () => {
    mocks.session = {
      user: { id: 'teacher-1', is_anonymous: false, email: 'teacher@school.ua' },
    }
    mocks.profileRow = { display_name: 'Вчителька', role: 'teacher', group_id: null }

    const identity = await getSessionIdentity()

    expect(identity.isAnonymous).toBe(false)
    expect(identity.email).toBe('teacher@school.ua')
  })
})
