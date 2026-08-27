export function computeAchievementStats(gamesWithHistory) {
  const categoryCounts = {}
  const allDates = []
  let perfectCount = 0

  gamesWithHistory.forEach(({ game, history }) => {
    if (!categoryCounts[game.category]) categoryCounts[game.category] = 0
    history.forEach((attempt) => {
      categoryCounts[game.category] += 1
      allDates.push(attempt.date.slice(0, 10))
      if (attempt.score >= 100) perfectCount += 1
    })
  })

  return {
    totalAttempts: allDates.length,
    dates: allDates,
    perfectCount,
    distinctGamesPlayed: gamesWithHistory.length,
    categoryCounts,
  }
}
