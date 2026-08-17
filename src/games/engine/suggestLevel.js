const RAISE_THRESHOLD = 85
const LOWER_THRESHOLD = 40

export function suggestLevel(config, history) {
  if (!history.length) {
    return { levelId: config.levels[0].id, isAutoSuggested: false }
  }

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
