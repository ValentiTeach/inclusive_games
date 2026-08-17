import { pickRandom } from '../engine/random'

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
      { label: 'Середній час', value: `${avgReaction} мс` },
    ],
  }
}
