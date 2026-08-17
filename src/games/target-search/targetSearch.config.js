import { pickRandom, shuffle } from '../engine/random'

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon']
const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b', '#1c9099']

export const config = {
  id: 'target-search',
  title: 'Пошук цілі',
  category: 'attention',
  description: 'Знайди серед фігур саме ту, що показана зверху як ціль.',
  instructions: [
    'Зверху показана ціль — форма й колір, які треба знайти.',
    'Натисни на фігуру в сцені, яка точно збігається з ціллю.',
    'Чим більше фігур навколо, тим складніше — уважно порівнюй форму й колір.',
  ],
  levels: [
    { id: 'easy', label: '8 фігур', distractors: 7, trialCount: 6 },
    { id: 'classic', label: '14 фігур', distractors: 13, trialCount: 8 },
    { id: 'hard', label: '20 фігур', distractors: 19, trialCount: 10 },
  ],
}

function randomCombo() {
  return { shape: pickRandom(SHAPES), color: pickRandom(COLORS) }
}

function comboKey(combo) {
  return `${combo.shape}|${combo.color}`
}

function buildGridPositions(count) {
  const columns = Math.ceil(Math.sqrt(count * 1.4))
  const rows = Math.ceil(count / columns)
  const cells = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      cells.push({ r, c })
    }
  }

  return shuffle(cells)
    .slice(0, count)
    .map(({ r, c }) => ({
      x: ((c + 0.5) / columns) * 100,
      y: ((r + 0.5) / rows) * 100,
    }))
}

export function generateTrial(level) {
  const target = randomCombo()
  const items = [{ ...target, isTarget: true }]

  while (items.length < level.distractors + 1) {
    const candidate = randomCombo()
    if (comboKey(candidate) === comboKey(target)) continue
    items.push({ ...candidate, isTarget: false })
  }

  const positions = buildGridPositions(items.length)
  const placed = shuffle(items).map((item, index) => ({
    ...item,
    ...positions[index],
    uid: index,
  }))

  return { target, items: placed }
}

export function checkAnswer(item) {
  return { correct: item.isTarget }
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
      { label: 'Середній час пошуку', value: `${avgReaction} мс` },
    ],
  }
}
