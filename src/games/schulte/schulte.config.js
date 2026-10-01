import { shuffle } from '../engine/random'
import { clampScore } from '../engine/score'
import { defineMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

export const config = {
  ...gameInfo('schulte'),
  instructions: [
    'На екрані зʼявиться таблиця з переплутаними числами.',
    'Натискай на числа по порядку: 1, 2, 3 і так далі.',
    'Намагайся дивитись у центр таблиці й ловити числа периферійним зором.',
  ],
  keyHint: { keys: 'Цифри', text: 'набрати число, яке шукаєш' },
  practice: {
    hint: 'Знайди 1 і натисни на нього, потім 2, потім 3 — по порядку, поки числа не закінчаться.',
    // Сітка 3 × 3: дев'ять чисел — досить, щоб зрозуміти правило, і мало, щоб
    // пробна гра не тягнулася довше за справжню.
    level: (level) => ({ ...level, size: 3 }),
  },
  relaxed: {
    note: 'Секундомір сховано, а бал рахується лише за помилками, не за часом.',
    rescore: (result) => ({
      ...result,
      score: clampScore(100 - (result.metrics.errors ?? 0) * 8),
    }),
  },
  levels: [
    { id: 'small', label: '4 × 4', size: 4 },
    { id: 'classic', label: '5 × 5', size: 5 },
    { id: 'large', label: '6 × 6', size: 6 },
  ],
}

export function generateTrial(level) {
  const total = level.size * level.size
  const numbers = Array.from({ length: total }, (_, i) => i + 1)
  return { size: level.size, cells: shuffle(numbers) }
}

export function checkAnswer(trial, response) {
  return { correct: response.clicked === response.expected }
}

export function scoring({ elapsedMs, mistakes, size }) {
  const seconds = elapsedMs / 1000
  const idealSeconds = size * size * 1.3
  const score = clampScore(100 - Math.max(0, seconds - idealSeconds) * 3 - mistakes * 8)

  // Час у мілісекундах, а не в секундах з одним знаком, як на екрані: округлення
  // для читання не має ставати округленням для вимірювання.
  const metrics = defineMetrics({
    duration_ms: Math.round(elapsedMs),
    errors: mistakes,
    grid_size: size,
    total: size * size,
  })

  return {
    score,
    entries: [
      { label: 'Час', value: `${seconds.toFixed(1)} с` },
      { label: 'Розмір таблиці', value: `${size} × ${size}` },
      { label: 'Помилкові натискання', value: String(mistakes) },
    ],
    metrics,
  }
}
