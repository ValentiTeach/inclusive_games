import { randomInt } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'

/**
 * Влучність у часі, а не швидкість.
 *
 * Решта ігор категорії питають «як швидко?». Ця питає «чи вчасно?» — дитина
 * має не випередити бігунець і не запізнитися, а зупинити його в потрібну
 * мить. Це інша здатність: гальмування вже початого руху, те саме, що дозволяє
 * не вигукнути відповідь раніше за питання.
 */
export const config = {
  id: 'catch-the-moment',
  title: 'Лови момент',
  category: 'reaction',
  description: 'Бігунець мчить по смузі — зупини його точно в зеленій зоні.',
  instructions: [
    'Бігунець рухається туди-сюди по смузі.',
    'Натисни пробіл або кнопку, коли він буде в зеленій зоні.',
    'Чим ближче до середини зони — тим більше балів.',
  ],
  keyHint: { keys: 'Пробіл', text: 'зупинити бігунець' },
  levels: [
    { id: 'wide', label: 'Широка зона', rounds: 6, zoneWidth: 26, periodMs: 2400 },
    { id: 'classic', label: 'Звичайна', rounds: 8, zoneWidth: 16, periodMs: 1900 },
    { id: 'narrow', label: 'Вузька і швидка', rounds: 10, zoneWidth: 10, periodMs: 1400 },
  ],
}

/**
 * Де стоїть бігунець через `elapsed` мілісекунд, у відсотках смуги.
 *
 * Винесено з компонента окремою функцією навмисно: рух малюється через
 * requestAnimationFrame, який у тестовому середовищі не йде, а перевірити
 * траєкторію треба. Тут вона — звичайна арифметика без екрана.
 *
 * Трикутна хвиля, а не синус: при синусі бігунець гальмує біля країв і
 * пролітає середину, тобто складність залежала б від того, де випала зона.
 */
export function positionAt(elapsedMs, periodMs) {
  const phase = ((elapsedMs % periodMs) + periodMs) % periodMs
  const half = periodMs / 2
  return phase <= half ? (phase / half) * 100 : 100 - ((phase - half) / half) * 100
}

/** Зона не притискається до країв: там бігунець розвертається, і влучити можна
 *  було б, просто затиснувши кнопку. */
export function randomZone(level) {
  const margin = 8
  const start = randomInt(margin, 100 - margin - level.zoneWidth)
  return { start, end: start + level.zoneWidth }
}

export function zoneCenter(zone) {
  return (zone.start + zone.end) / 2
}

/**
 * Промах — це теж число, а не просто «ні».
 *
 * Дитина, яка щоразу зупиняє бігунець за крок від зони, і та, що тисне
 * навмання, однаково мали б нуль влучань. Відхилення від центру зони показує
 * різницю між ними, і саме воно змінюється першим, коли з'являється прогрес.
 */
export function evaluate(zone, position) {
  const offset = Math.abs(position - zoneCenter(zone))
  return { hit: position >= zone.start && position <= zone.end, offsetPct: Math.round(offset) }
}

export function scoring(results) {
  const hits = results.filter((result) => result.hit).length
  const offsets = results.map((result) => result.offsetPct).filter(Number.isFinite)
  const total = results.length
  const avgOffset = offsets.length
    ? Math.round(offsets.reduce((sum, value) => sum + value, 0) / offsets.length)
    : undefined

  const metrics = defineMetrics({
    total,
    correct: hits,
    errors: total - hits,
    accuracy_pct: total ? Math.round((hits / total) * 100) : undefined,
    hits,
    avg_offset_pct: avgOffset,
    best_offset_pct: offsets.length ? Math.min(...offsets) : undefined,
  })

  /*
   * Бал рахується від відхилення, а не від влучань. Зона на найлегшому рівні
   * ширша за вузьку майже втричі, тож «влучив» там і тут означає різне, а
   * «промазав на 3% смуги» — те саме на будь-якому рівні.
   */
  return {
    score: Number.isFinite(avgOffset) ? clampScore(100 - avgOffset * 4) : 0,
    entries: [
      { label: 'Влучань', value: `${hits} / ${total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середнє відхилення', value: `${avgOffset ?? 0}% смуги` },
      { label: 'Найточніше', value: `${metrics.best_offset_pct ?? 0}% смуги` },
    ],
    metrics,
  }
}
