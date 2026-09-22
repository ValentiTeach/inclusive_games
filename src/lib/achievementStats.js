import { localDay } from './day'

/**
 * Числа, з яких виводяться всі досягнення.
 *
 * Історія приходить від найновішої спроби до найстарішої (так її зберігає
 * storage), тож усе, що залежить від послідовності, спершу впорядковується.
 */
export function computeAchievementStats(gamesWithHistory) {
  const categoryCounts = {}
  const distinctGamesByCategory = {}
  const allDates = []
  const categoriesPerDay = new Map()
  let perfectCount = 0
  let gamesWithPerfect = 0
  let gamesPlayedThrice = 0

  gamesWithHistory.forEach(({ game, history }) => {
    if (!categoryCounts[game.category]) categoryCounts[game.category] = 0
    distinctGamesByCategory[game.category] = (distinctGamesByCategory[game.category] ?? 0) + 1

    if (history.length >= 3) gamesPlayedThrice += 1
    if (history.some((attempt) => attempt.score >= 100)) gamesWithPerfect += 1

    history.forEach((attempt) => {
      categoryCounts[game.category] += 1
      // День за годинником дитини: обрізати ISO-рядок означало б рахувати
      // добу за Гринвічем, і все зігране після півночі падало б у вчора.
      const day = localDay(attempt.date)
      allDates.push(day)
      if (attempt.score >= 100) perfectCount += 1

      const seen = categoriesPerDay.get(day) ?? new Set()
      seen.add(game.category)
      categoriesPerDay.set(day, seen)
    })
  })

  return {
    totalAttempts: allDates.length,
    dates: allDates,
    perfectCount,
    distinctGamesPlayed: gamesWithHistory.length,
    categoryCounts,
    distinctGamesByCategory,
    gamesWithPerfect,
    gamesPlayedThrice,
    mostCategoriesInADay: mostCategoriesInADay(categoriesPerDay),
    longestPerfectRun: longestPerfectRun(gamesWithHistory),
    attemptsToday: countToday(allDates),
  }
}

function mostCategoriesInADay(categoriesPerDay) {
  let most = 0
  for (const categories of categoriesPerDay.values()) {
    most = Math.max(most, categories.size)
  }
  return most
}

/*
 * Найдовший ряд ідеальних результатів підряд — по всіх іграх разом, у порядку
 * часу. Рахувати всередині кожної гри окремо було б легше, але означало б інше:
 * дитина, яка чергує ігри, ніколи не побачила б цього досягнення, хоча грала
 * бездоганно.
 */
function longestPerfectRun(gamesWithHistory) {
  const attempts = gamesWithHistory
    .flatMap(({ history }) => history.map((attempt) => ({ date: attempt.date, score: attempt.score })))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  let longest = 0
  let run = 0
  for (const attempt of attempts) {
    run = attempt.score >= 100 ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  return longest
}

function countToday(dates) {
  const today = localDay()
  return dates.filter((date) => date === today).length
}
