export const config = {
  id: 'go-no-go',
  title: 'Go / No-Go',
  category: 'attention',
  description: 'Тисни на зелене коло, але стримайся, якщо з’явиться червоний квадрат.',
  instructions: [
    'На екрані по черзі з’являтимуться фігури.',
    'Тисни на кнопку, тільки коли бачиш зелене коло.',
    'Якщо зʼявився червоний квадрат — не тисни нічого, просто дочекайся наступної фігури.',
  ],
  levels: [
    { id: 'short', label: '15 фігур', trialCount: 15, windowMs: 1000 },
    { id: 'classic', label: '25 фігур', trialCount: 25, windowMs: 850 },
    { id: 'long', label: '35 фігур', trialCount: 35, windowMs: 700 },
  ],
}

export function generateTrial() {
  return { isGo: Math.random() < 0.7 }
}

export function checkAnswer(trial, response) {
  const pressed = response === 'pressed'

  if (trial.isGo) {
    return { correct: pressed, outcome: pressed ? 'hit' : 'miss' }
  }

  return { correct: !pressed, outcome: pressed ? 'false-alarm' : 'correct-reject' }
}

export function scoring(results) {
  const total = results.length
  const correct = results.filter((r) => r.correct).length
  const falseAlarms = results.filter((r) => r.outcome === 'false-alarm').length
  const misses = results.filter((r) => r.outcome === 'miss').length
  const accuracy = total ? Math.round((correct / total) * 100) : 0

  return [
    { label: 'Точність', value: `${accuracy}%` },
    { label: 'Хибні натискання', value: String(falseAlarms) },
    { label: 'Пропущені сигнали', value: String(misses) },
  ]
}
