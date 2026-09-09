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

export function saveResult(gameId, { score, entries, levelId, metrics }) {
  const attempt = { score, entries, metrics, levelId, date: new Date().toISOString() }
  const updated = [attempt, ...getResults(gameId)].slice(0, HISTORY_LIMIT)
  localStorage.setItem(KEY_PREFIX + gameId, JSON.stringify(updated))
  return updated
}

/**
 * Wipe every game's local history. Used when the computer is handed to another
 * child: these keys are per-browser, not per-child, so without this the next
 * child inherits the previous one's attempts — and, worse, uploads them to the
 * cloud as their own the moment they sign in (see migrateLocalHistoryOnce).
 */
export function clearAllResults() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
    return keys.length
  } catch {
    return 0
  }
}
