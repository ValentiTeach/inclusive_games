import { supabase, isCloudConfigured } from './supabaseClient'
import { GAMES } from '../data/games'
import {
  clearAllResults,
  getHistoryOwner,
  getResults,
  setHistoryOwner,
} from '../games/engine/storage'

const SYNCED_KEY_PREFIX = 'inclusive-games:synced:'

export async function pushResult(gameId, attempt) {
  if (!isCloudConfigured) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  await supabase.from('results').insert({
    user_id: session.user.id,
    game_id: gameId,
    score: attempt.score,
    entries: attempt.entries,
    // Спроби, зіграні до появи колонки, метрик не мають. null тут читається
    // так само, як у старих рядках бази: «не міряли».
    metrics: attempt.metrics ?? null,
    level_id: attempt.levelId,
    played_at: attempt.date,
  })
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
 * Спроба знаходиться за миттю гри: user_id + game_id + played_at — це той самий
 * ключ, на якому стоїть унікальний індекс, тож він завжди вказує рівно на один
 * рядок.
 *
 * Мовчазна невдача навмисна: дитина натиснула «важко», а мережа підвела — це не
 * привід показувати їй помилку посеред екрана з результатом. Локально оцінка
 * вже збережена, і саме вона впливає на наступний рівень.
 */
export async function pushRating(gameId, playedAt, felt) {
  if (!isCloudConfigured) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

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

export async function fetchCloudHistory() {
  if (!isCloudConfigured) return {}

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return {}

  const { data, error } = await supabase
    .from('results')
    .select('game_id, score, entries, metrics, level_id, played_at')
    .eq('user_id', session.user.id)
    .order('played_at', { ascending: false })

  if (error || !data) return {}

  const byGame = {}
  data.forEach((row) => {
    if (!byGame[row.game_id]) byGame[row.game_id] = []
    byGame[row.game_id].push({
      score: row.score,
      entries: row.entries,
      metrics: row.metrics ?? undefined,
      levelId: row.level_id,
      date: row.played_at,
    })
  })

  return byGame
}
