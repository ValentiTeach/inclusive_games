const KEY_PREFIX = 'inclusive-games:results:'

export function getResults(gameId) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + gameId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveResult(gameId, entries) {
  const updated = [{ entries, date: new Date().toISOString() }, ...getResults(gameId)].slice(
    0,
    10,
  )
  localStorage.setItem(KEY_PREFIX + gameId, JSON.stringify(updated))
  return updated
}
