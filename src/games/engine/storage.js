const KEY_PREFIX = 'inclusive-games:results:'
const HISTORY_LIMIT = 20

/**
 * Чия це локальна історія.
 *
 * Ключі з результатами належать браузеру, а не людині: на одному шкільному
 * комп'ютері грають по черзі кілька дітей і вчитель. Без позначки власника
 * будь-хто, хто ввійде наступним, забирає чужі спроби собі — і саме це сталося
 * на живому проекті: ігри вчителя опинилися в результатах двох учнів.
 *
 * Порожнє значення означає «грав гість»: такі спроби справді нічиї, і той, хто
 * вперше ввійде, має право забрати їх як свої.
 */
const OWNER_KEY = 'inclusive-games:history-owner'

export function getHistoryOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

export function setHistoryOwner(userId) {
  try {
    localStorage.setItem(OWNER_KEY, userId)
  } catch {
    // Приватне вікно або заповнене сховище: втратити позначку не страшно,
    // наступний вхід просто перевірить її заново.
  }
}

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
    // Разом з історією зникає і позначка власника: далі сховище знову «нічиє».
    localStorage.removeItem(OWNER_KEY)
    return keys.length
  } catch {
    return 0
  }
}
