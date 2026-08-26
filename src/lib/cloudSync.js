import { supabase, isCloudConfigured } from './supabaseClient'
import { GAMES } from '../data/games'
import { getResults } from '../games/engine/storage'

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
    level_id: attempt.levelId,
    played_at: attempt.date,
  })
}

export async function migrateLocalHistoryOnce(userId) {
  if (!isCloudConfigured) return

  const flagKey = SYNCED_KEY_PREFIX + userId
  if (localStorage.getItem(flagKey)) return

  const rows = GAMES.flatMap((game) =>
    getResults(game.id).map((attempt) => ({
      user_id: userId,
      game_id: game.id,
      score: attempt.score,
      entries: attempt.entries,
      level_id: attempt.levelId,
      played_at: attempt.date,
    })),
  )

  if (rows.length > 0) {
    await supabase.from('results').insert(rows)
  }

  localStorage.setItem(flagKey, '1')
}

export async function fetchCloudHistory() {
  if (!isCloudConfigured) return {}

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return {}

  const { data, error } = await supabase
    .from('results')
    .select('game_id, score, entries, level_id, played_at')
    .eq('user_id', session.user.id)
    .order('played_at', { ascending: false })

  if (error || !data) return {}

  const byGame = {}
  data.forEach((row) => {
    if (!byGame[row.game_id]) byGame[row.game_id] = []
    byGame[row.game_id].push({
      score: row.score,
      entries: row.entries,
      levelId: row.level_id,
      date: row.played_at,
    })
  })

  return byGame
}
