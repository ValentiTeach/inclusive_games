import { randomInt } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'

/**
 * Обсяг пам'яті на цифри — вправа зі шкільних і клінічних батарей.
 *
 * Відрізняється від решти ігор категорії тим, що вимірює не «скільки
 * правильно», а «скільки поміщається»: довжина ряду росте, поки дитина
 * справляється, і зупиняється там, де вже ні. Саме це число — обсяг — і є
 * результатом, а точність тут лише спосіб його знайти.
 *
 * Зворотний порядок — не просто складніше. Щоб назвати ряд задом наперед, його
 * треба не лише втримати, а ще й перебрати в голові, і ця різниця між «вперед»
 * і «назад» — те, на що дивляться насамперед.
 */
export const config = {
  id: 'digit-span',
  title: 'Послідовність цифр',
  category: 'memory',
  description: 'Запам’ятай ряд цифр і повтори його — у тому самому або у зворотному порядку.',
  instructions: [
    'Цифри з’являються по одній — запам’ятовуй їх.',
    'Потім набери той самий ряд: на клавіатурі або кнопками на екрані.',
    'На рівні «Назад» ряд треба повторити з кінця.',
  ],
  keyHint: { keys: 'Цифри', text: 'набрати ряд, Enter — підтвердити' },
  levels: [
    { id: 'forward', label: 'Вперед', direction: 'forward', startLength: 3, maxLength: 9 },
    { id: 'backward', label: 'Назад', direction: 'backward', startLength: 2, maxLength: 8 },
    { id: 'mixed', label: 'Вперед і назад', direction: 'mixed', startLength: 3, maxLength: 9 },
  ],
}

/** Скільки разів поспіль можна помилитися на одній довжині, перш ніж зупинитись. */
export const LIVES = 2

/** Показ однієї цифри. Довше, ніж здається потрібним: дитина має встигнути
 *  промовити цифру про себе, інакше гра міряє швидкість читання. */
export const DIGIT_MS = 800
export const BLANK_MS = 250

export function makeSequence(length) {
  const digits = []
  for (let i = 0; i < length; i++) {
    let digit = randomInt(0, 9)
    // Дві однакові цифри поспіль читаються як одна довга — дитина не бачить
    // межі між ними, і помилка буде не про пам'ять.
    while (digits.length && digit === digits[digits.length - 1]) digit = randomInt(0, 9)
    digits.push(digit)
  }
  return digits
}

export function directionFor(level, trialIndex) {
  if (level.direction !== 'mixed') return level.direction
  // Змішаний рівень чергує напрямки, а не кидає монету: інакше дитині могло б
  // випасти п'ять «назад» поспіль, і рівень перестав би бути змішаним.
  return trialIndex % 2 === 0 ? 'forward' : 'backward'
}

export function expectedAnswer(sequence, direction) {
  return direction === 'backward' ? [...sequence].reverse() : sequence
}

export function isCorrect(sequence, direction, typed) {
  const expected = expectedAnswer(sequence, direction)
  return typed.length === expected.length && expected.every((digit, i) => digit === typed[i])
}

/**
 * Обсяг — найдовший ряд, який дитина відтворила правильно, а не довжина, на якій
 * вона зупинилась. Зупинка настає після двох помилок, тобто на довжині,
 * *більшій* за досягнуту; брати її означало б завищувати результат кожному.
 */
export function computeSpan(results) {
  const correct = results.filter((result) => result.correct)
  return correct.length ? Math.max(...correct.map((result) => result.length)) : 0
}

// Сім цифр уперед — типовий дорослий обсяг; для дитини це відмінний результат.
const TARGET_SPAN = 7

export function scoring(results, extra = {}) {
  const span = computeSpan(results)
  const total = results.length
  const correct = results.filter((result) => result.correct).length

  const metrics = defineMetrics({
    total,
    correct,
    errors: total - correct,
    accuracy_pct: total ? Math.round((correct / total) * 100) : undefined,
    span,
    ...extra,
  })

  return {
    score: clampScore((span / TARGET_SPAN) * 100),
    entries: [
      { label: 'Обсяг пам’яті', value: `${span} цифр` },
      { label: 'Правильно', value: `${correct} / ${total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    ],
    metrics,
  }
}
