import { randomInt, shuffle } from '../engine/random'

export const config = {
  id: 'subitizing',
  title: 'Субітизація',
  category: 'attention',
  description: 'За частку секунди оціни, скільки крапок з’явилось на екрані.',
  instructions: [
    'На мить з’являться крапки — рахувати їх не встигнеш, лише оцінити «на око».',
    'Обери правильну кількість серед варіантів відповіді.',
  ],
  levels: [
    { id: 'easy', label: 'До 6, 700 мс', maxCount: 6, flashMs: 700, trialCount: 8 },
    { id: 'classic', label: 'До 9, 500 мс', maxCount: 9, flashMs: 500, trialCount: 10 },
    { id: 'hard', label: 'До 12, 350 мс', maxCount: 12, flashMs: 350, trialCount: 12 },
  ],
}

function generatePositions(count) {
  const positions = []
  let attempts = 0

  while (positions.length < count && attempts < count * 30) {
    attempts += 1
    const candidate = { x: randomInt(8, 92), y: randomInt(8, 92) }
    const tooClose = positions.some(
      (p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < 16,
    )
    if (!tooClose) positions.push(candidate)
  }

  while (positions.length < count) {
    positions.push({ x: randomInt(8, 92), y: randomInt(8, 92) })
  }

  return positions
}

function buildOptions(count, maxCount) {
  const offsets = shuffle([-2, -1, 1, 2])
  const distractors = offsets
    .map((offset) => count + offset)
    .filter((value) => value >= 1 && value <= maxCount + 2)
  const unique = Array.from(new Set([count, ...distractors])).slice(0, 4)

  while (unique.length < 4) {
    const candidate = randomInt(1, maxCount + 2)
    if (!unique.includes(candidate)) unique.push(candidate)
  }

  return shuffle(unique)
}

export function generateTrial(level) {
  const count = randomInt(2, level.maxCount)
  return {
    count,
    positions: generatePositions(count),
    options: buildOptions(count, level.maxCount),
  }
}

export function checkAnswer(trial, response) {
  return { correct: response === trial.count }
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
      { label: 'Середній час відповіді', value: `${avgReaction} мс` },
    ],
  }
}
