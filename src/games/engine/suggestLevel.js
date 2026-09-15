const RAISE_THRESHOLD = 85
const LOWER_THRESHOLD = 40

/*
 * Скільки останніх спроб у категорії враховувати і скільки їх треба щонайменше.
 * Одна спроба — це ще не рівень дитини, а випадковість; п'яти вистачає, щоб
 * побачити звичну для неї складність, і водночас достатньо мало, щоб успіхи
 * піврічної давнини не тримали її на місці.
 */
const CATEGORY_SAMPLE = 5
const CATEGORY_MIN_ATTEMPTS = 2

export function suggestLevel(config, history, categoryHistory = []) {
  if (history.length) {
    return fromOwnHistory(config, history)
  }

  /*
   * Гра нова, але навичка — ні. Дитина, що впевнено проходить «Що зникло»,
   * не має починати «Послідовність цифр» з найлегшого: це не виклик, а
   * витрачений урок. Тому шукаємо її звичну складність у сусідніх іграх тієї
   * самої категорії.
   */
  return fromCategory(config, categoryHistory) ?? startingPoint(config)
}

function startingPoint(config) {
  return { levelId: config.levels[0].id, isAutoSuggested: false }
}

function fromOwnHistory(config, history) {
  const last = history[0]
  const lastIndex = config.levels.findIndex((level) => level.id === last.levelId)
  const currentIndex = lastIndex === -1 ? 0 : lastIndex

  if (last.score >= RAISE_THRESHOLD && currentIndex < config.levels.length - 1) {
    return { levelId: config.levels[currentIndex + 1].id, isAutoSuggested: true }
  }

  if (last.score <= LOWER_THRESHOLD && currentIndex > 0) {
    return { levelId: config.levels[currentIndex - 1].id, isAutoSuggested: true }
  }

  return { levelId: config.levels[currentIndex].id, isAutoSuggested: false }
}

/*
 * Ігри однієї категорії мають різну кількість рівнів, тож порівнювати їх можна
 * тільки часткою: 0 — найлегший рівень гри, 1 — найважчий. Середня частка по
 * категорії лягає на рівні нової гри.
 */
function fromCategory(config, categoryHistory) {
  const shares = categoryHistory
    .flatMap((peer) => peer.attempts.map((attempt) => shareOf(peer.levels, attempt)))
    .filter((entry) => entry !== null)
    .sort((a, b) => b.date - a.date)
    .slice(0, CATEGORY_SAMPLE)

  if (shares.length < CATEGORY_MIN_ATTEMPTS) return null

  const average = shares.reduce((sum, entry) => sum + entry.share, 0) / shares.length
  const index = Math.round(average * (config.levels.length - 1))

  return { levelId: config.levels[index].id, isAutoSuggested: true }
}

function shareOf(levels, attempt) {
  const index = levels.findIndex((level) => level.id === attempt.levelId)
  if (index === -1) return null

  const steps = levels.length - 1
  if (steps === 0) return { share: 0, date: new Date(attempt.date).getTime() }

  /*
   * Бал за ту спробу зсуває частку на один рівень тієї гри: легко пройдений
   * рівень означає, що дитина вже переросла його, а провалений — що він був
   * зависокий. Без цього зсуву відмінник назавжди лишався б там, де почав.
   */
  let position = index
  if (attempt.score >= RAISE_THRESHOLD) position += 1
  else if (attempt.score <= LOWER_THRESHOLD) position -= 1

  const share = Math.min(1, Math.max(0, position / steps))
  return { share, date: new Date(attempt.date).getTime() }
}
