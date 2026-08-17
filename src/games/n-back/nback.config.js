import { pickRandom } from '../engine/random'

const LETTERS = ['Б', 'Г', 'Д', 'Ж', 'К', 'Л', 'П', 'Р']
const MATCH_RATE = 0.35

export const config = {
  id: 'n-back',
  title: 'N-back',
  category: 'memory',
  description: 'Натискай «Збіг!», коли поточна літера повторює ту, що була N кроків тому.',
  instructions: [
    'Літери зʼявлятимуться одна за одною.',
    'Якщо поточна літера збігається з тією, що була N кроків тому — тисни «Збіг!».',
    'Якщо не збігається — просто чекай наступну, нічого не тискай.',
  ],
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
  const total = results.length
  const correct = results.filter((r) => r.correct).length
  const hits = results.filter((r) => r.outcome === 'hit').length
  const targets = results.filter((r) => r.outcome === 'hit' || r.outcome === 'miss').length
  const falseAlarms = results.filter((r) => r.outcome === 'false-alarm').length
  const accuracy = total ? Math.round((correct / total) * 100) : 0

  return {
    score: accuracy,
    entries: [
      { label: 'Точність', value: `${accuracy}%` },
      { label: 'Знайдено збігів', value: `${hits} / ${targets}` },
      { label: 'Хибні натискання', value: String(falseAlarms) },
    ],
  }
}
