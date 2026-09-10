import { trialMetrics } from '../engine/metrics'
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
  keyHint: { keys: 'Пробіл', text: 'натиснути на зелене коло' },
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
  const count = (outcome) => results.filter((r) => r.outcome === outcome).length
  const hits = count('hit')
  const misses = count('miss')
  const falseAlarms = count('false-alarm')
  const correctRejections = count('correct-reject')

  // Загальна точність тут мало що каже: пропустити сигнал і натиснути на
  // заборонений — різні дефіцити (увага проти гальмування), і в базі вони
  // мають лишатися розрізненими.
  const metrics = trialMetrics(results, {
    hits,
    misses,
    false_alarms: falseAlarms,
    correct_rejections: correctRejections,
    go_trials: hits + misses,
    nogo_trials: falseAlarms + correctRejections,
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Хибні натискання', value: String(falseAlarms) },
      { label: 'Пропущені сигнали', value: String(misses) },
    ],
    metrics,
  }
}
