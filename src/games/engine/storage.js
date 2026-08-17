const KEY_PREFIX = 'inclusive-games:results:'
const HISTORY_LIMIT = 20

export function getResults(gameId) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + gameId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveResult(gameId, { score, entries, levelId }) {
  const attempt = { score, entries, levelId, date: new Date().toISOString() }
  const updated = [attempt, ...getResults(gameId)].slice(0, HISTORY_LIMIT)
  localStorage.setItem(KEY_PREFIX + gameId, JSON.stringify(updated))
  return updated
}
