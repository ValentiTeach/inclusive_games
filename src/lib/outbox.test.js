import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  rpc: vi.fn(),
  sessionUser: null,
}))

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    from: () => ({ insert: (...args) => mocks.insert(...args) }),
    rpc: (...args) => mocks.rpc(...args),
    auth: {
      getSession: async () => ({
        data: { session: mocks.sessionUser ? { user: mocks.sessionUser } : null },
      }),
    },
  },
}))

const {
  discardOutbox,
  enqueueRating,
  enqueueResult,
  flushOutbox,
  isPermanentError,
  onOutboxChange,
  pendingCount,
  pendingResults,
  resetOutboxForTests,
  settleOutbox,
  unsentText,
} = await import('./outbox')
const { pushResult, pushRating, mergeHistories } = await import('./cloudSync')

const ALICE = 'user-alice'
const BOB = 'user-bob'
const KEY = 'inclusive-games:outbox'

const NETWORK_DOWN = { error: { message: 'TypeError: Failed to fetch', code: '' } }
const OK = { error: null }

function attempt(date = '2026-09-24T10:00:00.000Z', score = 80) {
  return { score, entries: [], metrics: { total: 5 }, levelId: 'classic', date }
}

function queue() {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]')
}

beforeEach(() => {
  localStorage.clear()
  resetOutboxForTests()
  mocks.insert.mockReset()
  mocks.rpc.mockReset()
  mocks.insert.mockResolvedValue(OK)
  mocks.rpc.mockResolvedValue(OK)
  mocks.sessionUser = { id: ALICE }
})

describe('черга: доставка', () => {
  it('спроба доходить до сервера й зникає з черги', async () => {
    enqueueResult(ALICE, 'schulte', attempt())

    const summary = await flushOutbox(ALICE)

    expect(summary).toEqual({ sent: 1, dropped: 0, remaining: 0 })
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(mocks.insert.mock.calls[0][0]).toEqual({
      user_id: ALICE,
      game_id: 'schulte',
      score: 80,
      entries: [],
      metrics: { total: 5 },
      level_id: 'classic',
      played_at: '2026-09-24T10:00:00.000Z',
    })
    expect(queue()).toEqual([])
  })

  /**
   * Головне, заради чого черга існує: гра, зіграна на Wi-Fi, що саме відпав,
   * не має зникнути для вчителя.
   */
  it('без мережі спроба лишається в черзі й іде наступного разу', async () => {
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.insert.mockResolvedValueOnce(NETWORK_DOWN)

    const first = await flushOutbox(ALICE)
    expect(first).toEqual({ sent: 0, dropped: 0, remaining: 1 })
    expect(pendingCount(ALICE)).toBe(1)

    const second = await flushOutbox(ALICE)
    expect(second).toEqual({ sent: 1, dropped: 0, remaining: 0 })
    expect(mocks.insert).toHaveBeenCalledTimes(2)
  })

  it('fetch, що кинув замість повернути помилку, — теж «спробуй пізніше»', async () => {
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.insert.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(flushOutbox(ALICE)).resolves.toMatchObject({ remaining: 1 })
  })

  /**
   * Відповідь сервера могла загубитися, хоча вставка вдалася. Повтор тоді
   * натрапляє на унікальний індекс, і це означає «вже доставлено».
   */
  it('дублікат (23505) зараховується як доставлене', async () => {
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } })

    const summary = await flushOutbox(ALICE)

    expect(summary).toEqual({ sent: 1, dropped: 0, remaining: 0 })
  })

  /**
   * Запис, який сервер відкидає за змістом, повтор не виправить. Лишити його —
   * означало б назавжди заблокувати всі спроби за ним.
   */
  it('запис, відкинутий за змістом, викидається і не блокує решту', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))
    enqueueResult(ALICE, 'stroop', attempt('2026-09-24T10:05:00.000Z'))
    mocks.insert.mockResolvedValueOnce({ error: { code: '23514', message: 'check violation' } })

    const summary = await flushOutbox(ALICE)

    expect(summary).toEqual({ sent: 1, dropped: 1, remaining: 0 })
    expect(mocks.insert.mock.calls[1][0].game_id).toBe('stroop')
    warn.mockRestore()
  })

  it('після першої невдачі мережі решту не смикає', async () => {
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))
    enqueueResult(ALICE, 'stroop', attempt('2026-09-24T10:05:00.000Z'))
    mocks.insert.mockResolvedValueOnce(NETWORK_DOWN)

    await flushOutbox(ALICE)

    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(pendingCount(ALICE)).toBe(2)
  })

  it('спроби йдуть у тому порядку, в якому їх зіграли', async () => {
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))
    enqueueResult(ALICE, 'stroop', attempt('2026-09-24T10:05:00.000Z'))
    enqueueResult(ALICE, 'simon', attempt('2026-09-24T10:10:00.000Z'))

    await flushOutbox(ALICE)

    expect(mocks.insert.mock.calls.map(([row]) => row.game_id)).toEqual([
      'schulte',
      'stroop',
      'simon',
    ])
  })
})

describe('черга: оцінка «як тобі було»', () => {
  const PLAYED = '2026-09-24T10:00:00.000Z'

  /**
   * rate_attempt правит рядок, який уже має бути в базі. Якби оцінка обігнала
   * спробу, вона оновила б нуль рядків і мовчки загубилась би.
   */
  it('оцінка не йде раніше за свою спробу', async () => {
    enqueueResult(ALICE, 'schulte', attempt(PLAYED))
    enqueueRating(ALICE, 'schulte', PLAYED, 'hard')
    mocks.insert.mockResolvedValueOnce(NETWORK_DOWN)

    await flushOutbox(ALICE)

    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(queue().map((item) => item.kind)).toEqual(['result', 'rating'])
  })

  it('коли мережа є, оцінка йде слідом за спробою', async () => {
    enqueueResult(ALICE, 'schulte', attempt(PLAYED))
    enqueueRating(ALICE, 'schulte', PLAYED, 'hard')

    await flushOutbox(ALICE)

    expect(mocks.rpc).toHaveBeenCalledWith('rate_attempt', {
      p_game_id: 'schulte',
      p_played_at: PLAYED,
      p_felt: 'hard',
    })
    expect(queue()).toEqual([])
  })

  it('передумала — у черзі лишається тільки остання відповідь', () => {
    enqueueRating(ALICE, 'schulte', PLAYED, 'hard')
    enqueueRating(ALICE, 'schulte', PLAYED, 'ok')

    const ratings = queue().filter((item) => item.kind === 'rating')
    expect(ratings).toHaveLength(1)
    expect(ratings[0].felt).toBe('ok')
  })

  /**
   * Гонка, яку легко проґавити: стара оцінка саме летить на сервер, а дитина
   * вже натиснула іншу кнопку. Після відповіді має прибратися стара, а не нова.
   */
  it('нова відповідь, дана поки летить стара, не губиться', async () => {
    enqueueRating(ALICE, 'schulte', PLAYED, 'hard')

    let release
    mocks.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(OK)
        }),
    )

    const flushing = flushOutbox(ALICE)
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))

    enqueueRating(ALICE, 'schulte', PLAYED, 'easy')
    release()
    await flushing

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc.mock.calls[1][1].p_felt).toBe('easy')
    expect(queue()).toEqual([])
  })
})

describe('черга: одночасні виклики', () => {
  /**
   * onAuthStateChange, подія online і щойно зіграна гра легко збігаються в
   * часі. Та сама спроба не має полетіти двічі.
   */
  it('два одночасні виклики відправляють спробу один раз', async () => {
    enqueueResult(ALICE, 'schulte', attempt())

    await Promise.all([flushOutbox(ALICE), flushOutbox(ALICE)])

    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })

  it('спроба, що з’явилась під час відправки, теж іде', async () => {
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))

    let release
    mocks.insert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(OK)
        }),
    )

    const flushing = flushOutbox(ALICE)
    await vi.waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))

    enqueueResult(ALICE, 'stroop', attempt('2026-09-24T10:05:00.000Z'))
    const second = flushOutbox(ALICE)
    release()
    await Promise.all([flushing, second])

    expect(mocks.insert).toHaveBeenCalledTimes(2)
    expect(queue()).toEqual([])
  })
})

describe('черга: спільний комп’ютер', () => {
  /**
   * RLS пропускає лише власні рядки. Відправити чужу спробу від себе — це або
   * відмова сервера, або, гірше, чужа гра під своїм іменем.
   */
  it('чужі спроби не відправляються від імені того, хто зараз у сеансі', async () => {
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.sessionUser = { id: BOB }

    await flushOutbox(ALICE)
    await flushOutbox(BOB)

    expect(mocks.insert).not.toHaveBeenCalled()
    expect(pendingCount(ALICE)).toBe(1)
  })

  it('без сеансу нічого не відправляється, але й не губиться', async () => {
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.sessionUser = null

    const summary = await flushOutbox(ALICE)

    expect(summary.remaining).toBe(1)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('відправка одного не чіпає черги іншого', async () => {
    enqueueResult(BOB, 'stroop', attempt('2026-09-24T09:00:00.000Z'))
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))

    await flushOutbox(ALICE)

    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(queue()).toHaveLength(1)
    expect(queue()[0].userId).toBe(BOB)
  })

  it('discardOutbox прибирає лише записи цього користувача', () => {
    enqueueResult(ALICE, 'schulte', attempt())
    enqueueRating(ALICE, 'schulte', attempt().date, 'ok')
    enqueueResult(BOB, 'stroop', attempt())

    discardOutbox(ALICE)

    expect(queue()).toHaveLength(1)
    expect(queue()[0].userId).toBe(BOB)
  })
})

describe('черга: остання нагода перед передачею', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('коли мережа є, повертає 0 — нічого не лишилось', async () => {
    enqueueResult(ALICE, 'schulte', attempt())

    await expect(settleOutbox(ALICE)).resolves.toBe(0)
  })

  it('коли мережі немає, каже, скільки лишилось', async () => {
    enqueueResult(ALICE, 'schulte', attempt('2026-09-24T10:00:00.000Z'))
    enqueueResult(ALICE, 'stroop', attempt('2026-09-24T10:05:00.000Z'))
    mocks.insert.mockResolvedValue(NETWORK_DOWN)

    await expect(settleOutbox(ALICE)).resolves.toBe(2)
  })

  /**
   * Ледве жива мережа може тримати запит хвилинами. Дитина, що передає
   * комп'ютер, не має стояти й чекати.
   */
  it('не тримає довше за межу, навіть коли запит завис', async () => {
    vi.useFakeTimers()
    enqueueResult(ALICE, 'schulte', attempt())
    mocks.insert.mockImplementation(() => new Promise(() => {}))

    const settled = settleOutbox(ALICE, 1000)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(settled).resolves.toBe(1)
  })
})

describe('черга: що ще в дорозі', () => {
  it('pendingResults віддає спроби у формі хмарної історії, з оцінкою', () => {
    const played = '2026-09-24T10:00:00.000Z'
    enqueueResult(ALICE, 'schulte', attempt(played, 64))
    enqueueRating(ALICE, 'schulte', played, 'hard')
    enqueueResult(BOB, 'schulte', attempt(played, 99))

    expect(pendingResults(ALICE)).toEqual({
      schulte: [
        {
          score: 64,
          entries: [],
          metrics: { total: 5 },
          levelId: 'classic',
          date: played,
          felt: 'hard',
        },
      ],
    })
  })

  it('pendingCount рахує спроби, а не оцінки', () => {
    const played = '2026-09-24T10:00:00.000Z'
    enqueueResult(ALICE, 'schulte', attempt(played))
    enqueueRating(ALICE, 'schulte', played, 'ok')

    expect(pendingCount(ALICE)).toBe(1)
  })

  it('слухач дізнається про зміну черги', async () => {
    const listener = vi.fn()
    onOutboxChange(listener)

    enqueueResult(ALICE, 'schulte', attempt())
    await flushOutbox(ALICE)

    // Поставили в чергу, потім прибрали після відправки.
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('черга має стелю і не з’їдає все сховище', () => {
    const items = Array.from({ length: 510 }, (_, index) => ({
      id: `old-${index}`,
      kind: 'result',
      userId: ALICE,
      gameId: 'schulte',
      playedAt: `t${index}`,
      row: {},
    }))
    localStorage.setItem(KEY, JSON.stringify(items))

    enqueueResult(ALICE, 'schulte', attempt())

    const stored = queue()
    expect(stored).toHaveLength(500)
    // Поступаються найстаріші, а щойно зіграна лишається.
    expect(stored.at(-1).playedAt).toBe(attempt().date)
  })
})

describe('isPermanentError', () => {
  it.each([
    ['23514', true], // check violation
    ['23502', true], // not null
    ['23503', true], // foreign key
    ['22P02', true], // invalid text representation
    ['23505', false], // дублікат — це «вже доставлено», а не відмова
    ['42501', false], // RLS: може бути гонкою сеансів, не викидаємо
    ['PGRST204', false], // колонки ще немає в кеші схеми — чекаємо міграцію
    ['PGRST301', false], // прострочений токен
    ['', false], // мережа
    [undefined, false],
  ])('%s → %s', (code, expected) => {
    expect(isPermanentError({ code })).toBe(expected)
  })
})

describe('unsentText', () => {
  it.each([
    [1, '1 гра ще не надіслана'],
    [2, '2 гри ще не надіслані'],
    [4, '4 гри ще не надіслані'],
    [5, '5 ігор ще не надіслано'],
    [11, '11 ігор ще не надіслано'],
    [12, '12 ігор ще не надіслано'],
    [21, '21 гра ще не надіслана'],
    [22, '22 гри ще не надіслані'],
  ])('%i', (count, text) => {
    expect(unsentText(count)).toBe(text)
  })
})

describe('pushResult / pushRating', () => {
  it('спроба гостя в чергу не потрапляє: її перенесе вхід', async () => {
    await pushResult(null, 'schulte', attempt())

    expect(queue()).toEqual([])
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('спроба учня стає в чергу й одразу йде', async () => {
    await pushResult(ALICE, 'schulte', attempt())

    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(queue()).toEqual([])
  })

  it('без мережі — лишається в черзі', async () => {
    mocks.insert.mockResolvedValue(NETWORK_DOWN)

    await pushResult(ALICE, 'schulte', attempt())

    expect(pendingCount(ALICE)).toBe(1)
  })

  it('оцінка теж іде через чергу', async () => {
    await pushRating(ALICE, 'schulte', attempt().date, 'easy')

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(queue()).toEqual([])
  })

  describe('коли сховище недоступне', () => {
    let realStorage

    beforeEach(() => {
      realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')
      const boom = () => {
        throw new Error('сховище недоступне')
      }
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: { getItem: boom, setItem: boom, removeItem: boom, key: boom, clear: boom },
      })
    })

    afterEach(() => {
      if (realStorage) Object.defineProperty(window, 'localStorage', realStorage)
    })

    /**
     * Приватне вікно: черги немає де тримати. Тоді як до неї — один запит.
     * Гірше, ніж черга, але не гірше, ніж було.
     */
    it('спроба все одно йде одним запитом', async () => {
      await pushResult(ALICE, 'schulte', attempt())

      expect(mocks.insert).toHaveBeenCalledTimes(1)
      expect(mocks.insert.mock.calls[0][0]).toMatchObject({ user_id: ALICE, game_id: 'schulte' })
    })

    it('і не падає, коли мережі теж немає', async () => {
      mocks.insert.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(pushResult(ALICE, 'schulte', attempt())).resolves.toBeUndefined()
    })
  })
})

describe('mergeHistories', () => {
  /**
   * База віддає мить як «+00:00», браузер пише «Z». Рядки різні, мить та сама,
   * і спроба, що встигла дійти, не має показатися двічі.
   */
  it('та сама мить у різних записах — одна спроба', () => {
    const cloud = { schulte: [{ score: 80, date: '2026-09-24T10:00:00+00:00' }] }
    const local = { schulte: [{ score: 80, date: '2026-09-24T10:00:00.000Z' }] }

    expect(mergeHistories(cloud, local).schulte).toHaveLength(1)
  })

  it('перевага за першим джерелом', () => {
    const cloud = { schulte: [{ score: 80, date: '2026-09-24T10:00:00Z', felt: 'ok' }] }
    const local = { schulte: [{ score: 80, date: '2026-09-24T10:00:00.000Z' }] }

    expect(mergeHistories(cloud, local).schulte[0].felt).toBe('ok')
  })

  it('найновіша спроба перша, ігри з обох джерел', () => {
    const cloud = { schulte: [{ score: 1, date: '2026-09-20T10:00:00Z' }] }
    const local = {
      schulte: [{ score: 2, date: '2026-09-24T10:00:00Z' }],
      stroop: [{ score: 3, date: '2026-09-22T10:00:00Z' }],
    }

    const merged = mergeHistories(cloud, local)

    expect(merged.schulte.map((a) => a.score)).toEqual([2, 1])
    expect(merged.stroop).toHaveLength(1)
  })

  it('порожні ігри не з’являються', () => {
    expect(mergeHistories({ schulte: [] }, {})).toEqual({})
    expect(mergeHistories(null, undefined)).toEqual({})
  })
})
