import { pickRandom } from '../engine/random'

export const COLORS = [
  { id: 'red', label: 'Червоний', hex: '#c0392b' },
  { id: 'blue', label: 'Синій', hex: '#2d6bd6' },
  { id: 'green', label: 'Зелений', hex: '#2e8b57' },
  { id: 'yellow', label: 'Жовтий', hex: '#c8862b' },
]

export const config = {
  id: 'stroop',
  title: 'Тест Струпа',
  category: 'attention',
  description: 'Обери колір, яким написано слово, — а не те, що воно означає.',
  instructions: [
    'На екрані зʼявиться слово-назва кольору, написане певним кольором шрифту.',
    'Натисни кнопку з кольором шрифту слова, а не з тим кольором, який слово називає.',
    'Наприклад, якщо написано «Синій» жовтими літерами — тисни «Жовтий».',
  ],
  levels: [
    { id: 'short', label: '10 слів', trialCount: 10 },
    { id: 'classic', label: '20 слів', trialCount: 20 },
    { id: 'long', label: '30 слів', trialCount: 30 },
  ],
}

export function generateTrial() {
  const word = pickRandom(COLORS)
  const ink = pickRandom(COLORS)
  return { word, ink }
}

export function checkAnswer(trial, response) {
  return { correct: response === trial.ink.id }
}

export function scoring(results) {
  const total = results.length
  const correct = results.filter((r) => r.correct).length
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  const avgReaction = total
    ? Math.round(results.reduce((sum, r) => sum + r.reactionTimeMs, 0) / total)
    : 0

  return {
    score: accuracy,
    entries: [
      { label: 'Правильно', value: `${correct} / ${total}` },
      { label: 'Точність', value: `${accuracy}%` },
      { label: 'Середній час реакції', value: `${avgReaction} мс` },
    ],
  }
}
