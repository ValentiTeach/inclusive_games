const DAY_MS = 24 * 60 * 60 * 1000

export function computeStreak(dateStrings) {
  const uniqueDates = [...new Set(dateStrings)].sort()

  if (uniqueDates.length === 0) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let run = 1

  for (let i = 1; i < uniqueDates.length; i++) {
    const diffDays = Math.round(
      (new Date(uniqueDates[i]) - new Date(uniqueDates[i - 1])) / DAY_MS,
    )
    run = diffDays === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  const dateSet = new Set(uniqueDates)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10)

  let current = 0
  if (dateSet.has(today) || dateSet.has(yesterday)) {
    let cursor = new Date(dateSet.has(today) ? today : yesterday)
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      current += 1
      cursor = new Date(cursor.getTime() - DAY_MS)
    }
  }

  return { current, longest }
}
