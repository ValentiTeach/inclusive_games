import { supabase, isCloudConfigured } from './supabaseClient'

/**
 * Черга на відправку: спроби й оцінки, які ще не дійшли до хмари.
 *
 * Досі результат учня, що ввійшов, ішов у хмару одним запитом просто з екрана
 * результатів. Помилку ніхто не читав і не повторював, а локальна історія після
 * першого входу вже ніколи не вивантажувалась удруге. Тож гра на шкільному Wi-Fi,
 * який саме відпав, зникала для вчителя назавжди — і з «Мого прогресу» теж,
 * бо той для учня показує тільки хмару.
 *
 * Тепер кожна спроба спершу лягає сюди, а звідси зникає лише тоді, коли сервер
 * її прийняв. Відправка повторюється при кожній новій грі, при вході й тоді,
 * коли браузер каже, що мережа повернулася.
 *
 * Повтор безпечний: у базі стоїть унікальний індекс на (user_id, game_id,
 * played_at), і друга вставка тієї самої спроби отримує 23505 — а це для нас
 * означає «вже доставлено», а не помилку. Тому байдуже, чи відповідь сервера
 * загубилась по дорозі: у найгіршому разі спроба просто прийде вдруге й буде
 * відкинута.
 */

const KEY = 'inclusive-games:outbox'

/*
 * Стеля — на випадок, якщо браузер тижнями не бачить мережі. П'ятсот спроб —
 * це кілька місяців щоденних занять; далі старіші поступаються новішим, щоб
 * черга не з'їла все сховище і не зламала збереження самих ігор.
 */
const MAX_ITEMS = 500

/*
 * Скільки чекати на відправку перед тим, як віддати комп'ютер наступній дитині.
 * Без мережі запит падає миттєво, але «мережа є, та ледве жива» може тримати
 * його хвилинами — а дитина стоїть і чекає на кнопку.
 */
const SETTLE_TIMEOUT_MS = 5000

const UNIQUE_VIOLATION = '23505'

/* ── Сховище ─────────────────────────────────────────────────────────────── */

function readQueue() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items) {
  try {
    if (items.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)))
    notify()
    return true
  } catch {
    return false
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/* ── Підписка на зміни ───────────────────────────────────────────────────── */

const listeners = new Set()

function notify() {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Слухач, що впав, не має зупиняти решту — і тим паче саму чергу.
    }
  })
}

/**
 * Сторінка прогресу показує, скільки спроб ще в дорозі, і має дізнатися, коли
 * їх стало менше. Повертає функцію відписки. Разом з outboxSnapshot — пара для
 * useSyncExternalStore.
 */
export function onOutboxChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Незмінний знімок черги для useSyncExternalStore: сирий рядок зі сховища.
 * Рядок порівнюється за значенням, тож React перемальовує сторінку лише тоді,
 * коли черга справді змінилась.
 */
export function outboxSnapshot() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/* ── Постановка в чергу ──────────────────────────────────────────────────── */

/**
 * Рядок таблиці results із локальної спроби. user_id сюди не входить: його
 * дописує відправка, бо саме він вирішує, чия це спроба.
 */
export function resultRow(gameId, attempt) {
  return {
    game_id: gameId,
    score: attempt.score,
    entries: attempt.entries,
    // Спроби, зіграні до появи колонки, метрик не мають. null тут читається
    // так само, як у старих рядках бази: «не міряли».
    metrics: attempt.metrics ?? null,
    level_id: attempt.levelId,
    played_at: attempt.date,
  }
}

/**
 * @returns запис черги, якщо спроба лягла в чергу; false — якщо писати нікуди
 *          (приватне вікно, переповнене сховище).
 */
export function enqueueResult(userId, gameId, attempt) {
  if (!userId || !attempt) return false

  const item = {
    id: newId(),
    kind: 'result',
    userId,
    gameId,
    playedAt: attempt.date,
    row: resultRow(gameId, attempt),
  }
  return writeQueue([...readQueue(), item]) ? item : false
}

/**
 * Оцінка «легко / нормально / важко» — правка вже збереженої спроби, тож вона
 * мусить прийти після самої спроби. Черга тримає порядок, тому оцінка стає в
 * хвіст і за спробою не обганяє.
 *
 * Дитина може передумати й натиснути іншу кнопку. Правильна тоді остання
 * відповідь, а попередня, що ще не пішла, просто замінюється. Заміна отримує
 * новий id навмисно: якщо стару саме відправляють, то після відповіді сервера
 * прибереться стара, а нова лишиться й піде наступною.
 */
export function enqueueRating(userId, gameId, playedAt, felt) {
  if (!userId || !playedAt) return false

  const sameAttempt = (entry) =>
    entry.kind === 'rating' &&
    entry.userId === userId &&
    entry.gameId === gameId &&
    entry.playedAt === playedAt

  const item = { id: newId(), kind: 'rating', userId, gameId, playedAt, felt }
  return writeQueue([...readQueue().filter((entry) => !sameAttempt(entry)), item]) ? item : false
}

/* ── Що ще не дійшло ─────────────────────────────────────────────────────── */

export function pendingCount(userId) {
  if (!userId) return 0
  return readQueue().filter((item) => item.kind === 'result' && item.userId === userId).length
}

/**
 * Спроби, які ще в дорозі, у тій самій формі, що й fetchCloudHistory: щоб
 * сторінка прогресу могла показати їх поруч із хмарними й дитина не бачила,
 * як щойно зіграна гра «пропала».
 */
export function pendingResults(userId) {
  const byGame = {}
  if (!userId) return byGame

  const queue = readQueue()
  const ratings = new Map(
    queue
      .filter((item) => item.kind === 'rating' && item.userId === userId)
      .map((item) => [`${item.gameId}|${item.playedAt}`, item.felt]),
  )

  queue
    .filter((item) => item.kind === 'result' && item.userId === userId)
    .forEach(({ gameId, row }) => {
      const felt = ratings.get(`${gameId}|${row.played_at}`)
      if (!byGame[gameId]) byGame[gameId] = []
      byGame[gameId].push({
        score: row.score,
        entries: row.entries,
        metrics: row.metrics ?? undefined,
        levelId: row.level_id,
        date: row.played_at,
        ...(felt ? { felt } : {}),
      })
    })

  return byGame
}

/**
 * Прибрати з черги все, що належить цьому користувачеві.
 *
 * Лише для анонімного сеансу, який щойно завершено: такий акаунт відкрити
 * знову неможливо, тож його спроби вже ніхто не відправить, а лежати в
 * браузері спільного комп'ютера чужі дані дитини не мають.
 */
export function discardOutbox(userId) {
  const queue = readQueue()
  const rest = queue.filter((item) => item.userId !== userId)
  if (rest.length !== queue.length) writeQueue(rest)
}

/**
 * «1 гра ще не надіслана», «3 гри ще не надіслані», «5 ігор ще не надіслано».
 */
export function unsentText(count) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} гра ще не надіслана`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} гри ще не надіслані`
  }
  return `${count} ігор ще не надіслано`
}

/* ── Відправка ───────────────────────────────────────────────────────────── */

/**
 * Помилка, яку повтор не виправить: сервер відкинув самі дані (22xxx —
 * неправильне значення, 23xxx — порушення обмеження). Така спроба
 * викидається, інакше вона стояла б у голові черги вічно й не пускала б
 * решту.
 *
 * Усе інше — мережа, 5xx, прострочений токен, колонка, якої ще немає в кеші
 * схеми (PGRST204), — вважається тимчасовим. Краще почекати, поки міграцію
 * застосують, ніж мовчки викинути гру дитини.
 */
export function isPermanentError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  return /^2[23][0-9A-Z]{3}$/.test(code) && code !== UNIQUE_VIOLATION
}

/**
 * @returns 'sent' | 'dropped' | 'retry'
 */
async function deliver(item) {
  try {
    const { error } =
      item.kind === 'result'
        ? await supabase.from('results').insert({ ...item.row, user_id: item.userId })
        : await supabase.rpc('rate_attempt', {
            p_game_id: item.gameId,
            p_played_at: item.playedAt,
            p_felt: item.felt,
          })

    if (!error) return 'sent'
    // Та сама спроба вже в базі: попередня відправка дійшла, загубилась лише
    // відповідь. Для черги це успіх.
    if (error.code === UNIQUE_VIOLATION) return 'sent'
    if (isPermanentError(error)) {
      console.warn('[inclusive-games] сервер відхилив запис із черги', item.kind, error)
      return 'dropped'
    }
    return 'retry'
  } catch {
    // supabase-js зазвичай повертає помилку, а не кидає, але fetch без мережі
    // у деяких браузерах усе ж кидає. Для черги це те саме, що й «спробуй
    // пізніше».
    return 'retry'
  }
}

function removeItem(id) {
  const queue = readQueue()
  const rest = queue.filter((item) => item.id !== id)
  if (rest.length !== queue.length) writeQueue(rest)
}

async function sessionUserId() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Один прохід черги.
 *
 * Черга перечитується перед кожним записом, а не береться знімком на початку:
 * поки йде відправка, дитина може дограти ще одну гру чи змінити оцінку, і
 * знімок про це не знав би.
 *
 * Зупинка на першій тимчасовій невдачі — навмисна. Якщо впала мережа, решта
 * запитів упаде так само; а головне, оцінка не має піти раніше за свою спробу.
 */
async function flushPass(userId, summary) {
  /*
   * Записи підписуються тим, хто зараз у сеансі, а не тим, чий id у записі:
   * RLS пропустить лише власні. Якщо на пристрої вже хтось інший, чужі
   * записи лишаються чекати свого власника.
   */
  if ((await sessionUserId()) !== userId) {
    summary.failed = true
    return
  }

  for (;;) {
    const item = readQueue().find((entry) => entry.userId === userId)
    if (!item) return

    const outcome = await deliver(item)
    if (outcome === 'retry') {
      summary.failed = true
      return
    }

    removeItem(item.id)
    if (outcome === 'sent') summary.sent += 1
    else summary.dropped += 1
  }
}

const running = new Map()

/**
 * Відправити все, що чекає на цього користувача.
 *
 * Одночасні виклики не запускають другу відправку тих самих записів:
 * onAuthStateChange, подія online і щойно зіграна гра легко збігаються в
 * часі. Пізніший виклик просить ще один прохід після поточного — саме на
 * випадок, якщо його запис з'явився в черзі вже після того, як прохід її
 * перечитав.
 *
 * @returns { sent, dropped, remaining }
 */
export function flushOutbox(userId) {
  if (!isCloudConfigured || !userId) {
    return Promise.resolve({ sent: 0, dropped: 0, remaining: pendingCount(userId) })
  }

  const current = running.get(userId)
  if (current) {
    current.again = true
    return current.promise
  }

  const state = { again: false, promise: null }
  state.promise = (async () => {
    const summary = { sent: 0, dropped: 0, failed: false }
    do {
      state.again = false
      await flushPass(userId, summary)
    } while (state.again && !summary.failed)

    return { sent: summary.sent, dropped: summary.dropped, remaining: pendingCount(userId) }
  })().finally(() => running.delete(userId))

  running.set(userId, state)
  return state.promise
}

/**
 * Остання спроба відправити перед тим, як сеанс закінчиться.
 *
 * Обмежена в часі: дитина, що передає комп'ютер, не має стояти хвилину перед
 * кнопкою через ледве живу мережу. Якщо не встигли — відправка не
 * скасовується, вона просто вже не тримає інтерфейс.
 *
 * @returns скільки спроб так і не пішло
 */
export async function settleOutbox(userId, timeoutMs = SETTLE_TIMEOUT_MS) {
  if (!userId) return 0

  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })

  try {
    await Promise.race([flushOutbox(userId).catch(() => {}), timeout])
  } finally {
    clearTimeout(timer)
  }

  return pendingCount(userId)
}

/**
 * Відправка при поверненні мережі. Повертає функцію відписки.
 *
 * Подія online не гарантує, що сервер досяжний, — лише що з'явився якийсь
 * інтерфейс. Але хибна тривога коштує один невдалий запит, а пропущена —
 * гру, що лежить у черзі до наступного запуску.
 */
export function flushWhenOnline(userId) {
  if (!userId) return () => {}

  const handler = () => {
    void flushOutbox(userId)
  }

  try {
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  } catch {
    return () => {}
  }
}

/** Лише для тестів: забуває відправки, що нібито ще тривають. */
export function resetOutboxForTests() {
  running.clear()
  listeners.clear()
}
