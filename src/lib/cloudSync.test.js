import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    from: () => ({ insert: (...args) => insert(...args) }),
    auth: { getSession: vi.fn() },
  },
}))

const { migrateLocalHistoryOnce } = await import('./cloudSync')
const { saveResult, getResults, getHistoryOwner, setHistoryOwner } = await import(
  '../games/engine/storage'
)

const ALICE = 'user-alice'
const BOB = 'user-bob'

function playLocally(gameId = 'schulte') {
  saveResult(gameId, { score: 70, entries: [], levelId: 'classic', metrics: { total: 5 } })
}

describe('перенесення локальної історії в хмару', () => {
  beforeEach(() => {
    localStorage.clear()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
  })

  it('переносить спроби гостя і позначає власника', async () => {
    playLocally()

    await migrateLocalHistoryOnce(ALICE)

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toHaveLength(1)
    expect(insert.mock.calls[0][0][0]).toMatchObject({ user_id: ALICE, game_id: 'schulte' })
    expect(getHistoryOwner()).toBe(ALICE)
  })

  /**
   * З цієї миті правда живе в хмарі. Копія в браузері лишалася б тільки
   * приводом завантажити те саме вдруге.
   */
  it('після перенесення локальні спроби стираються', async () => {
    playLocally()

    await migrateLocalHistoryOnce(ALICE)

    expect(getResults('schulte')).toEqual([])
  })

  /**
   * Головна поломка, яку це лікує: onAuthStateChange спрацьовує двічі, і обидва
   * виклики встигали пройти перевірку прапорця до того, як перший його допише.
   * На живому проекті це дало по дві однакові спроби в трьох записах.
   */
  it('два одночасні виклики вантажать історію один раз', async () => {
    playLocally()

    await Promise.all([migrateLocalHistoryOnce(ALICE), migrateLocalHistoryOnce(ALICE)])

    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('повторний виклик після успіху нічого не вантажить', async () => {
    playLocally()
    await migrateLocalHistoryOnce(ALICE)
    playLocally()

    await migrateLocalHistoryOnce(ALICE)

    expect(insert).toHaveBeenCalledTimes(1)
  })

  /**
   * Друга поломка з живих даних: ігри вчителя, який показував гру класу, стали
   * результатами дитини, що ввійшла наступною на тому самому комп'ютері.
   */
  it('чужу історію не забирає собі', async () => {
    playLocally()
    setHistoryOwner(ALICE)

    await migrateLocalHistoryOnce(BOB)

    expect(insert).not.toHaveBeenCalled()
  })

  it('і не лишає чужу історію на екрані', async () => {
    playLocally()
    setHistoryOwner(ALICE)

    await migrateLocalHistoryOnce(BOB)

    expect(getResults('schulte')).toEqual([])
    expect(getHistoryOwner()).toBe(BOB)
  })

  /**
   * Локальна історія — єдиний примірник спроб дитини. Позначити її як
   * перенесену до того, як вставка справді вдалася, означало б втратити її
   * назавжди через одну невдалу мить мережі.
   */
  it('після невдалої вставки історія лишається і переноситься наступного разу', async () => {
    playLocally()
    insert.mockResolvedValueOnce({ error: { message: 'мережа впала' } })

    await expect(migrateLocalHistoryOnce(ALICE)).rejects.toBeTruthy()
    expect(getResults('schulte')).toHaveLength(1)

    insert.mockResolvedValue({ error: null })
    await migrateLocalHistoryOnce(ALICE)

    expect(insert).toHaveBeenCalledTimes(2)
    expect(getResults('schulte')).toEqual([])
  })

  it('порожню історію не вантажить, але власника запам’ятовує', async () => {
    await migrateLocalHistoryOnce(ALICE)

    expect(insert).not.toHaveBeenCalled()
    expect(getHistoryOwner()).toBe(ALICE)
  })
})

describe('браузери, що працювали до появи теґу власника', () => {
  beforeEach(() => {
    localStorage.clear()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
  })

  /**
   * Саме цей стан і породив чужі спроби в живій базі: історію вже вивантажили
   * під одним іменем, теґу власника ще не існувало, а наступний вхід на тому
   * самому комп'ютері вантажив її вдруге — вже як свою.
   */
  it('не віддають стару історію наступному учневі', async () => {
    playLocally()
    localStorage.setItem('inclusive-games:synced:' + ALICE, '1')

    await migrateLocalHistoryOnce(BOB)

    expect(insert).not.toHaveBeenCalled()
    expect(getResults('schulte')).toEqual([])
  })

  it('але тому самому учневі нічого не ламають', async () => {
    playLocally()
    localStorage.setItem('inclusive-games:synced:' + ALICE, '1')

    await migrateLocalHistoryOnce(ALICE)

    expect(insert).not.toHaveBeenCalled()
    expect(getResults('schulte')).toHaveLength(1)
  })
})
