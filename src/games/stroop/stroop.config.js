import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

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
  // Рядки нижче будуються з metrics, а не рахуються вдруге: інакше екран і
  // база могли б розійтися, і ніхто б цього не помітив.
  const metrics = trialMetrics(results)

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час реакції', value: `${metrics.avg_rt_ms ?? 0} мс` },
    ],
    metrics,
  }
}
