import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'

/**
 * Реакція вибору, на відміну від простої реакції в грі «Швидкість реакції».
 *
 * Там сигнал один і думати нема над чим: побачив — натиснув. Тут сигналів
 * кілька, і між «побачив» і «натиснув» додається вибір. Саме цей проміжок і
 * росте в дитини з порушенням уваги, тоді як проста реакція може лишатися
 * звичайною, — тож дві гри міряють різні речі й не замінюють одна одну.
 */
export const SIGNALS = [
  { id: 'red', label: 'Стій', color: '#d64545', action: 'Червоний' },
  { id: 'yellow', label: 'Чекай', color: '#d9a227', action: 'Жовтий' },
  { id: 'green', label: 'Їдь', color: '#2f9e5f', action: 'Зелений' },
]

export const config = {
  id: 'traffic-light',
  title: 'Світлофор',
  category: 'reaction',
  description: 'Загоряється один із вогнів — натисни саме ту кнопку, що йому відповідає.',
  instructions: [
    'Світлофор загоряється несподівано — одним із кольорів.',
    'Натисни кнопку того самого кольору якнайшвидше.',
    'Не вгадуй наперед: натискання до сигналу не зараховується.',
  ],
  // Не «1–3»: на рівні з двома вогнями третьої кнопки немає, і підказка
  // обіцяла б те, чого на екрані не існує. Номер кожної кнопки й так написано
  // в її кутку (OptionKey).
  keyHint: { keys: 'Цифри', text: 'вибрати вогонь' },
  levels: [
    { id: 'two', label: 'Два вогні', rounds: 8, signalCount: 2 },
    { id: 'three', label: 'Три вогні', rounds: 10, signalCount: 3 },
    { id: 'long', label: 'Три вогні, довше', rounds: 16, signalCount: 3 },
  ],
}

export function signalsOfLevel(level) {
  return SIGNALS.slice(0, level.signalCount)
}

/** Пауза перед сигналом. Випадкова, щоб момент не можна було вивчити напам'ять. */
export function randomDelayMs() {
  return 900 + Math.random() * 2100
}

export function nextSignal(level, previous = null) {
  const pool = signalsOfLevel(level)
  let signal = pickRandom(pool)
  // Той самий вогонь двічі поспіль перетворює вибір на просту реакцію:
  // дитина вже тримає палець на потрібній кнопці.
  while (pool.length > 1 && signal.id === previous) signal = pickRandom(pool)
  return signal
}

// Реакція вибору повільніша за просту: там 250 мс уже добре, тут — близько 450.
const GOOD_MS = 450
const POOR_MS = 1400

/**
 * Оцінка множить швидкість на точність, а не додає їх.
 *
 * Дитина, яка тисне навмання й швидко, інакше отримала б пристойний бал: у цій
 * грі три кнопки, тобто третина влучань дістається просто так. Множення
 * прибирає цю лазівку — при точності 33% від швидкості лишається третина.
 */
export function scoring(results, extra = {}) {
  const metrics = trialMetrics(results, extra)
  const avg = metrics.avg_rt_ms
  const speed =
    Number.isFinite(avg) ? clampScore(100 - ((avg - GOOD_MS) / (POOR_MS - GOOD_MS)) * 100) : 0
  const accuracy = metrics.accuracy_pct ?? 0

  return {
    score: clampScore((speed * accuracy) / 100),
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${accuracy}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
      { label: 'Найкращий час', value: `${metrics.best_rt_ms ?? 0} мс` },
      { label: 'Натиснув зарано', value: String(metrics.early_presses ?? 0) },
    ],
    metrics,
  }
}
