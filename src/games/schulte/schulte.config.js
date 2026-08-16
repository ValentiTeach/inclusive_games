import { shuffle } from '../engine/random'

export const config = {
  id: 'schulte',
  title: 'Таблиці Шульте',
  category: 'attention',
  description:
    'Знайди числа від 1 до N по порядку якнайшвидше, не відриваючи погляд від центру таблиці.',
  instructions: [
    'На екрані зʼявиться таблиця з переплутаними числами.',
    'Натискай на числа по порядку: 1, 2, 3 і так далі.',
    'Намагайся дивитись у центр таблиці й ловити числа периферійним зором.',
  ],
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
  return [
    { label: 'Час', value: `${seconds.toFixed(1)} с` },
    { label: 'Розмір таблиці', value: `${size} × ${size}` },
    { label: 'Помилкові натискання', value: String(mistakes) },
  ]
}
