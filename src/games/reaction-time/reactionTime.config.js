import { clampScore } from '../engine/score'

export const config = {
  id: 'reaction-time',
  title: 'Швидкість реакції',
  category: 'reaction',
  description: 'Натисни, щойно екран стане зеленим. Не поспішай — передчасний клік не рахується.',
  instructions: [
    'Чекай, поки з’явиться зелений сигнал «Тисни!».',
    'Натисни на нього якомога швидше.',
    'Якщо натиснеш заздалегідь — раунд почнеться спочатку.',
  ],
  levels: [
    { id: 'short', label: '5 раундів', rounds: 5 },
    { id: 'classic', label: '8 раундів', rounds: 8 },
    { id: 'long', label: '12 раундів', rounds: 12 },
  ],
}

export function randomDelayMs() {
  return 1000 + Math.random() * 2000
}

const GOOD_MS = 250
const POOR_MS = 900

export function scoring(reactionTimes) {
  const total = reactionTimes.length
  const avg = total ? Math.round(reactionTimes.reduce((sum, t) => sum + t, 0) / total) : 0
  const best = total ? Math.min(...reactionTimes) : 0
  const score = total
    ? clampScore(100 - ((avg - GOOD_MS) / (POOR_MS - GOOD_MS)) * 100)
    : 0

  return {
    score,
    entries: [
      { label: 'Середній час', value: `${avg} мс` },
      { label: 'Найкращий час', value: `${best} мс` },
      { label: 'Раундів зіграно', value: String(total) },
    ],
  }
}
