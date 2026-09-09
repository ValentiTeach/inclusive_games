import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

export const config = {
  id: 'mental-rotation',
  title: 'Обертання фігур',
  category: 'thinking',
  description: 'Визнач, чи друга фігура — це та сама, повернута під кутом, чи її дзеркальне відображення.',
  instructions: [
    'Зліва — еталонна фігура. Справа — та сама фігура, повернута на певний кут.',
    'Якщо праву фігуру можна отримати простим поворотом лівої — тисни «Однакова».',
    'Якщо права фігура — дзеркальне відображення (поворотом не отримати) — тисни «Дзеркальна».',
  ],
  levels: [
    { id: 'easy', label: 'Легкий', trialCount: 8, angles: [0, 90, 180, 270] },
    { id: 'classic', label: 'Середній', trialCount: 10, angles: [0, 45, 90, 135, 180, 225, 270, 315] },
    {
      id: 'hard',
      label: 'Складний',
      trialCount: 12,
      angles: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    },
  ],
}

export function generateTrial(level) {
  return {
    angle: pickRandom(level.angles),
    mirrored: Math.random() < 0.5,
  }
}

export function checkAnswer(trial, response) {
  const guessedMirrored = response === 'mirrored'
  return { correct: guessedMirrored === trial.mirrored }
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
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
    ],
    metrics,
  }
}
