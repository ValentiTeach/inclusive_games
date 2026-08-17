import { pickRandom, randomInt, shuffle } from '../engine/random'

export const config = {
  id: 'quick-math',
  title: 'Швидкий рахунок',
  category: 'thinking',
  description: 'Розв’яжи якомога більше прикладів на час — обери правильну відповідь.',
  instructions: [
    'На екрані зʼявиться приклад.',
    'Обери правильну відповідь серед чотирьох варіантів.',
    'Що швидше й точніше вирішуєш приклади — то кращий результат.',
  ],
  levels: [
    { id: 'easy', label: 'Легкий (+ −, до 20)', trialCount: 10, maxValue: 20, operations: ['+', '-'] },
    {
      id: 'classic',
      label: 'Середній (+ − ×, до 50)',
      trialCount: 15,
      maxValue: 50,
      operations: ['+', '-', '×'],
    },
    {
      id: 'hard',
      label: 'Складний (+ − ×, до 100)',
      trialCount: 20,
      maxValue: 100,
      operations: ['+', '-', '×'],
    },
  ],
}

function buildOptions(answer) {
  const offsets = shuffle([-3, -2, -1, 1, 2, 3]).slice(0, 3)
  const distractors = offsets.map((offset) => Math.max(0, answer + offset))
  const unique = Array.from(new Set([answer, ...distractors]))

  while (unique.length < 4) {
    unique.push(answer + unique.length + 4)
  }

  return shuffle(unique.slice(0, 4))
}

export function generateTrial(level) {
  const operation = pickRandom(level.operations)
  let a
  let b
  let answer

  if (operation === '+') {
    a = randomInt(1, level.maxValue)
    b = randomInt(1, level.maxValue)
    answer = a + b
  } else if (operation === '-') {
    a = randomInt(1, level.maxValue)
    b = randomInt(0, a)
    answer = a - b
  } else {
    const maxFactor = Math.min(12, Math.max(2, Math.floor(Math.sqrt(level.maxValue))))
    a = randomInt(2, maxFactor)
    b = randomInt(2, maxFactor)
    answer = a * b
  }

  return { text: `${a} ${operation} ${b}`, answer, options: buildOptions(answer) }
}

export function checkAnswer(trial, response) {
  return { correct: response === trial.answer }
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
      { label: 'Середній час на приклад', value: `${avgReaction} мс` },
    ],
  }
}
