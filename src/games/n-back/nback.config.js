import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { slower } from '../engine/adapt'
import { gameInfo } from '../../data/games'

const LETTERS = ['Б', 'Г', 'Д', 'Ж', 'К', 'Л', 'П', 'Р']
const MATCH_RATE = 0.35

export const config = {
  ...gameInfo('n-back'),
  instructions: [
    'Літери зʼявлятимуться одна за одною.',
    'Якщо поточна літера збігається з тією, що була N кроків тому — тисни «Збіг!».',
    'Якщо не збігається — просто чекай наступну, нічого не тискай.',
  ],
  keyHint: { keys: 'Пробіл', text: 'позначити збіг' },
  practice: {
    hint: (level) =>
      level.n === 1
        ? 'Тисни, коли літера така сама, як попередня. Якщо інша — нічого не тисни.'
        : `Тисни, коли літера така сама, як ${level.n} літери тому. Якщо інша — нічого не тисни.`,
    // Перші N літер не мають із чим порівнюватися, тож проб має бути помітно
    // більше за N, інакше пробна гра скінчиться, не давши жодного збігу.
    level: (level) => ({ ...level, trialCount: level.n + 6 }),
  },
  relaxed: {
    note: 'Кожна літера показується майже вдвічі довше.',
    level: (level) => ({ ...level, stimulusMs: slower(level.stimulusMs, 1.75) }),
  },
  levels: [
    { id: 'one-back', label: '1-back', n: 1, trialCount: 20, stimulusMs: 2200 },
    { id: 'two-back', label: '2-back', n: 2, trialCount: 24, stimulusMs: 2000 },
    { id: 'three-back', label: '3-back', n: 3, trialCount: 28, stimulusMs: 1800 },
  ],
}

export function generateTrial(level) {
  const sequence = []
  const isTarget = []

  for (let i = 0; i < level.trialCount; i++) {
    const canRepeat = i >= level.n
    if (canRepeat && Math.random() < MATCH_RATE) {
      sequence.push(sequence[i - level.n])
      isTarget.push(true)
      continue
    }

    let letter
    do {
      letter = pickRandom(LETTERS)
    } while (canRepeat && letter === sequence[i - level.n])
    sequence.push(letter)
    isTarget.push(false)
  }

  return { sequence, isTarget }
}

export function checkAnswer(trial, index, pressed) {
  const isMatch = trial.isTarget[index]

  if (isMatch) {
    return { correct: pressed, outcome: pressed ? 'hit' : 'miss' }
  }

  return { correct: !pressed, outcome: pressed ? 'false-alarm' : 'correct-reject' }
}

export function scoring(results) {
  const count = (outcome) => results.filter((r) => r.outcome === outcome).length
  const hits = count('hit')
  const misses = count('miss')
  const falseAlarms = count('false-alarm')

  const metrics = trialMetrics(results, {
    hits,
    misses,
    targets: hits + misses,
    false_alarms: falseAlarms,
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Знайдено збігів', value: `${hits} / ${hits + misses}` },
      { label: 'Хибні натискання', value: String(falseAlarms) },
    ],
    metrics,
  }
}
