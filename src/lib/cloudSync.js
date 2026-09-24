import { supabase, isCloudConfigured } from './supabaseClient'
import { GAMES } from '../data/games'
import { enqueueRating, enqueueResult, flushOutbox, resultRow } from './outbox'
import {
  clearAllResults,
  getHistoryOwner,
  getResults,
  setHistoryOwner,
} from '../games/engine/storage'

const SYNCED_KEY_PREFIX = 'inclusive-games:synced:'

/**
 * Спроба учня, що ввійшов, — у хмару через чергу (див. lib/outbox).
 *
 * userId приходить від того, хто викликає, а не з getSession: з простроченим
 * токеном без мережі getSession може не повернути сесію взагалі, і тоді гра,
 * зіграна саме офлайн, не потрапила б навіть у чергу.
 */
export async function pushResult(userId, gameId, attempt) {
  if (!isCloudConfigured || !userId || !attempt) return

  if (enqueueResult(userId, gameId, attempt)) {
    await flushOutbox(userId)
    return
  }

  /*
   * Писати в чергу нікуди — приватне вікно чи переповнене сховище. Тоді як
   * раніше: один запит, і якщо не вийшло, то не вийшло. Це гірше за чергу, але
   * не гірше, ніж було до неї.
   */
  try {
    await supabase.from('results').insert({ ...resultRow(gameId, attempt), user_id: userId })
  } catch {
    // Мовчки: дитина вже бачить свій результат, помилка мережі їй нічого не дасть.
  }
}

/*
 * Одночасні виклики для того самого користувача.
 *
 * onAuthStateChange спрацьовує більш ніж один раз (INITIAL_SESSION, потім
 * SIGNED_IN), і перевірка прапорця в localStorage від цього не рятує: обидва
 * виклики встигали пройти її до того, як перший допише прапорець після await.
 * На живому проекті це дало по дві однакові спроби в трьох записах — та сама
 * гра, той самий бал, та сама мітка часу до мілісекунди.
 *
 * Обіцянка в пам'яті модуля розв'язує саме це: другий виклик не починає роботу
 * заново, а чекає на перший.
 */
const inFlight = new Map()

/**
 * Перенести локальну історію в хмару — один раз і лише якщо вона справді твоя.
 *
 * Дві умови, і кожна закриває свою поломку:
 *
 * - Історія з чужою позначкою власника не переноситься взагалі. Інакше ігри
 *   вчителя, який показував гру класу, стають результатами дитини, що ввійшла
 *   наступною, — і вчитель читає як дитячі власні ж спроби.
 * - Після успішного перенесення локальні спроби стираються: з цієї миті правда
 *   живе в хмарі, а копія в браузері лишалася б лише приводом завантажити те
 *   саме вдруге.
 */
/**
 * Оцінка складності для однієї спроби.
 *
 * Теж через чергу, і це важливо не лише для офлайну: оцінка правит рядок, який
 * мусить уже бути в базі. Якщо сама спроба ще в черзі, то оцінка, відправлена
 * напряму, оновила б нуль рядків і мовчки загубилась би. У черзі вона стоїть
 * за своєю спробою і не обганяє її.
 *
 * Локально оцінка вже збережена, і саме вона впливає на наступний рівень, тож
 * невдала мережа дитині нічого не ламає — і показувати їй помилку немає сенсу.
 */
export async function pushRating(userId, gameId, playedAt, felt) {
  if (!isCloudConfigured || !userId) return

  if (enqueueRating(userId, gameId, playedAt, felt)) {
    await flushOutbox(userId)
    return
  }

  try {
    await supabase.rpc('rate_attempt', {
      p_game_id: gameId,
      p_played_at: playedAt,
      p_felt: felt,
    })
  } catch {
    // Оцінка — не результат гри; втратити її мовчки краще, ніж лякати дитину.
  }
}

export async function migrateLocalHistoryOnce(userId) {
  if (!isCloudConfigured) return

  const existing = inFlight.get(userId)
  if (existing) return existing

  const work = runMigration(userId).finally(() => inFlight.delete(userId))
  inFlight.set(userId, work)
  return work
}

/*
 * Браузери, що вже побували в роботі до появи теґу власника, мають лише старий
 * прапорець «синхронізовано» з чужим ідентифікатором усередині ключа. Для них
 * це єдиний слід того, чиї спроби лежать у localStorage, — і його досить, щоб
 * не віддати їх наступній дитині за тим самим комп'ютером.
 */
function legacyOwner() {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(SYNCED_KEY_PREFIX)) return key.slice(SYNCED_KEY_PREFIX.length)
    }
  } catch {
    return null
  }
  return null
}

/*
 * Сховище може бути недоступне: приватне вікно, заборонені дані сайту. Прапорець
 * «перенесено» тоді просто не переживе вкладку, і наступний вхід спробує знову —
 * це прийнятно. Неприйнятно, щоб вхід у застосунок валився через те, що браузер
 * не дає писати на диск.
 */
function readFlag(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Без прапорця перенесення повториться наступного разу — і нічого не
    // зіпсує: спроби вже вивантажені, а локальні стерті.
  }
}

async function runMigration(userId) {
  const flagKey = SYNCED_KEY_PREFIX + userId
  if (readFlag(flagKey)) return

  const owner = getHistoryOwner() ?? legacyOwner()
  if (owner && owner !== userId) {
    /*
     * Історія належить іншій людині. Її не можна ні завантажити як свою, ні
     * лишити в браузері: наступний екран прогресу показав би чужі спроби. Те
     * саме рішення, що й у startFreshStudentSession, тільки спрацьовує саме.
     */
    clearAllResults()
    setHistoryOwner(userId)
    writeFlag(flagKey)
    return
  }

  const rows = GAMES.flatMap((game) =>
    getResults(game.id).map((attempt) => ({
      user_id: userId,
      game_id: game.id,
      score: attempt.score,
      entries: attempt.entries,
      metrics: attempt.metrics ?? null,
      level_id: attempt.levelId,
      played_at: attempt.date,
    })),
  )

  if (rows.length === 0) {
    setHistoryOwner(userId)
    writeFlag(flagKey)
    return
  }

  const { error } = await supabase.from('results').insert(rows)

  /*
   * Прапорець ставиться лише після успіху. Поставити його наперед означало б
   * втратити історію дитини, якщо мережа підвела саме в цю мить, — а це
   * єдиний примірник її спроб.
   */
  if (error) throw error

  clearAllResults()
  setHistoryOwner(userId)
  writeFlag(flagKey)
}

/**
 * Уся хмарна історія учня, згрупована за іграми.
 *
 * null означає «не вдалося дізнатися» — немає мережі, сесії чи сервер
 * відповів помилкою. Це не те саме, що {} («ще нічого не грав»): досі обидва
 * випадки виглядали однаково, і дитина без мережі читала, що в неї немає
 * жодної зіграної гри.
 */
export async function fetchCloudHistory() {
  if (!isCloudConfigured) return null

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return null

    const { data, error } = await supabase
      .from('results')
      .select('game_id, score, entries, metrics, level_id, played_at, felt')
      .eq('user_id', session.user.id)
      .order('played_at', { ascending: false })

    if (error || !data) return null

    const byGame = {}
    data.forEach((row) => {
      if (!byGame[row.game_id]) byGame[row.game_id] = []
      byGame[row.game_id].push({
        score: row.score,
        entries: row.entries,
        metrics: row.metrics ?? undefined,
        levelId: row.level_id,
        date: row.played_at,
        ...(row.felt ? { felt: row.felt } : {}),
      })
    })

    return byGame
  } catch {
    return null
  }
}

/**
 * Хмарна історія плюс те, що ще в дорозі.
 *
 * Спроба, яка вже дійшла, але ще й досі в черзі (відповідь сервера загубилась),
 * не має двоїтися: однакова мить гри — це та сама спроба. Мить порівнюється як
 * час, а не як рядок: база віддає «+00:00», браузер пише «Z».
 */
export function mergeHistories(primary, extra) {
  const merged = {}
  const games = new Set([...Object.keys(primary ?? {}), ...Object.keys(extra ?? {})])

  games.forEach((gameId) => {
    const seen = new Set()
    const attempts = []
    ;[...(primary?.[gameId] ?? []), ...(extra?.[gameId] ?? [])].forEach((attempt) => {
      const moment = Date.parse(attempt.date)
      const key = Number.isNaN(moment) ? attempt.date : moment
      if (seen.has(key)) return
      seen.add(key)
      attempts.push(attempt)
    })
    attempts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    if (attempts.length > 0) merged[gameId] = attempts
  })

  return merged
}
