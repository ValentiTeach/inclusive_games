import { randomInt } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Числова пряма — чуття числа: де на прямій від 0 до 100 стоїть 37?
 *
 * Найкраще вивчений ранній показник математичних труднощів. Дитина з
 * несформованим уявленням про величину «стискає» великі числа: ставить 70
 * ближче до середини, ніж треба. Похибка рахується у відсотках довжини
 * прямої — тож рівні з різним діапазоном порівнянні між собою.
 */
export const config = {
  ...gameInfo('number-line'),
  instructions: [
    'Зверху — число. Під ним — пряма з нулем на початку і найбільшим числом у кінці.',
    'Натисни на прямій там, де, на твою думку, стоїть це число.',
    'Без миші: стрілки ← → рухають позначку, Enter — відповісти.',
  ],
  keyHint: { keys: '← → та Enter', text: 'поставити позначку' },
  practice: {
    hint: 'Половина прямої — це половина найбільшого числа. Спершу знайди середину, потім вирішуй — лівіше чи правіше.',
  },
  levels: [
    { id: 'ten', label: '0–10', trialCount: 8, max: 10, tick: 1 },
    { id: 'twenty', label: '0–20', trialCount: 10, max: 20, tick: 5 },
    { id: 'hundred', label: '0–100', trialCount: 10, max: 100, tick: 10 },
    // Дроби — та сама пряма, тільки від 0 до 1. Саме тут видно, чи розуміє
    // дитина, що ⅓ менша за ½, хоча «три» більше за «два».
    { id: 'fractions', label: 'Дроби 0–1', trialCount: 8, max: 1, tick: 0.5, fractions: true },
  ],
}

export const FRACTIONS = [
  { value: 1 / 2, label: '½' },
  { value: 1 / 4, label: '¼' },
  { value: 3 / 4, label: '¾' },
  { value: 1 / 3, label: '⅓' },
  { value: 2 / 3, label: '⅔' },
  { value: 1 / 5, label: '⅕' },
  { value: 1 / 10, label: '⅒' },
  { value: 4 / 5, label: '⅘' },
]

/* Кінці прямої підписані, тож питати про них — значить перевіряти читання. */
export function generateTrial(level, previous) {
  if (level.fractions) {
    const options = FRACTIONS.filter((fraction) => fraction.label !== previous?.label)
    const fraction = options[Math.floor(Math.random() * options.length)]
    return { target: fraction.value, label: fraction.label }
  }
  let target
  do {
    target = randomInt(1, level.max - 1)
  } while (target === previous?.target && level.max > 3)
  return { target }
}

/** Похибка у відсотках довжини прямої. */
export function errorPct(level, trial, answer) {
  return (Math.abs(answer - trial.target) / level.max) * 100
}

/*
 * Влучанням вважається відповідь у межах 5% прямої: на 0–10 це пів поділки,
 * на 0–100 — п'ять одиниць.
 */
export const HIT_PCT = 5

export function checkAnswer(level, trial, answer) {
  const error = errorPct(level, trial, answer)
  return { correct: error <= HIT_PCT, errorPct: error }
}

/** Значення, яке відповідає точці на прямій (частка від 0 до 1). */
export function valueAt(level, fraction) {
  const clamped = Math.min(1, Math.max(0, fraction))
  // На прямій 0–1 крок у десяту частину заокруглив би ¼ до 0,3 — тому сота.
  const precision = level.max <= 1 ? 100 : 10
  return Math.round(clamped * level.max * precision) / precision
}

export function scoring(results) {
  const errors = results.map((result) => result.errorPct)
  const mean = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0
  const correct = results.filter((result) => result.correct).length

  const metrics = defineMetrics({
    total: results.length,
    correct,
    errors: results.length - correct,
    accuracy_pct: results.length ? Math.round((correct / results.length) * 100) : undefined,
    estimate_error_pct: results.length ? Math.round(mean * 10) / 10 : undefined,
  })

  return {
    // Чотири бали за кожен відсоток похибки: 5% (межа влучання) — це 80.
    score: results.length ? clampScore(100 - mean * 4) : 0,
    entries: [
      { label: 'Влучань', value: `${correct} / ${results.length}` },
      { label: 'Середня похибка', value: `${metrics.estimate_error_pct ?? 0}% прямої` },
    ],
    metrics,
  }
}
