import { localDay, dayBefore } from './day'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param dateStrings дні у вигляді YYYY-MM-DD за місцевим часом дитини
 */
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
  const today = localDay()
  const yesterday = dayBefore(today)

  let current = 0
  if (dateSet.has(today) || dateSet.has(yesterday)) {
    /*
     * Курсор іде по рядках днів, а не по мілісекундах: рядки вже місцеві, а
     * крок робиться в UTC-опівночі, де доба завжди рівно доба — інакше ніч
     * переходу на зимовий час зарахувала б той самий день двічі.
     */
    let cursor = dateSet.has(today) ? today : yesterday
    while (dateSet.has(cursor)) {
      current += 1
      cursor = dayBefore(cursor)
    }
  }

  return { current, longest }
}
