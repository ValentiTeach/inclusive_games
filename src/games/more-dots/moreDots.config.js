import { randomInt } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { slower } from '../engine/adapt'
import { gameInfo } from '../../data/games'

/**
 * Де більше? — порівняння кількостей без лічби (приблизне чуття числа, ANS).
 *
 * Пара до «Числової прямої». Хмарки видно лише мить, тож порахувати не
 * встигнеш — доводиться покладатися на відчуття «тут більше». Складність
 * задається не кількістю крапок, а відношенням: 2:1 відчуває навіть
 * немовля, 5:4 — уже виклик і для дорослого.
 *
 * Розмір крапок у хмарці різний: інакше більше крапок завжди займало б більше
 * площі, і дитина порівнювала б плями, а не кількість.
 */
export const config = {
  ...gameInfo('more-dots'),
  instructions: [
    'На мить зʼявляться дві хмарки крапок — ліворуч і праворуч.',
    'Не рахуй — просто відчуй, де крапок більше, і натисни цей бік.',
    'Що далі, то ближча кількість у хмарках.',
  ],
  keyHint: { keys: '← / →', text: 'де більше' },
  practice: {
    hint: 'Рахувати не встигнеш — і не треба. Глянь на обидві хмарки й обери ту, що здається густішою.',
  },
  relaxed: {
    note: 'Хмарки видно довше.',
    level: (level) => ({ ...level, showMs: slower(level.showMs, 2) }),
  },
  levels: [
    { id: 'double', label: 'Удвічі більше', trialCount: 12, ratio: 2, showMs: 1200 },
    { id: 'half', label: 'У півтора раза', trialCount: 16, ratio: 1.5, showMs: 1000 },
    { id: 'close', label: 'Майже порівну', trialCount: 20, ratio: 1.25, showMs: 800 },
  ],
}

export function generateTrial(level) {
  const smaller = randomInt(5, 12)
  const larger = Math.round(smaller * level.ratio)
  const moreOn = Math.random() < 0.5 ? 'left' : 'right'
  return {
    moreOn,
    left: moreOn === 'left' ? larger : smaller,
    right: moreOn === 'right' ? larger : smaller,
  }
}

/** Розкидає крапки в полі 100×100 так, щоб вони не налазили одна на одну. */
export function scatter(count, random = Math.random) {
  const dots = []
  let attempts = 0
  while (dots.length < count && attempts < 5000) {
    attempts += 1
    const r = 3 + random() * 4
    const x = r + random() * (100 - 2 * r)
    const y = r + random() * (100 - 2 * r)
    if (dots.every((dot) => Math.hypot(dot.x - x, dot.y - y) > dot.r + r + 2)) dots.push({ x, y, r })
  }
  return dots
}

export function checkAnswer(trial, side) {
  return { correct: side === trial.moreOn }
}

export function scoring(results) {
  const metrics = trialMetrics(results)
  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
    ],
    metrics,
  }
}
