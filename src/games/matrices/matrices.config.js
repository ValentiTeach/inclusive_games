import { pickRandom, shuffle } from '../engine/random'

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'cross', 'pentagon']
const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b', '#1c9099', '#d24b64', '#8a5a34']
const SIZES = [22, 32, 44]

export const config = {
  id: 'matrices',
  title: 'Матриці',
  category: 'thinking',
  description:
    'Знайди закономірність у сітці 3×3 і вибери фігуру, яка має стояти замість знака питання.',
  instructions: [
    'У сітці є правило — колір, форма чи розмір змінюються за певним патерном.',
    'Знайди правило й обери правильний варіант для клітинки зі знаком питання.',
  ],
  levels: [
    { id: 'easy', label: 'Легкий', trialCount: 6, templates: ['color-shift', 'size-progress'] },
    {
      id: 'classic',
      label: 'Середній',
      trialCount: 8,
      templates: ['color-shift', 'size-progress', 'shape-shift'],
    },
    {
      id: 'hard',
      label: 'Складний',
      trialCount: 10,
      templates: ['color-shift', 'size-progress', 'shape-shift'],
    },
  ],
}

function pickN(pool, n) {
  return shuffle(pool).slice(0, n)
}

function buildColorShift() {
  const shape = pickRandom(SHAPES)
  const colors = pickN(COLORS, 3)
  const spareColor = pickRandom(COLORS.filter((c) => !colors.includes(c)))
  const grid = []

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push({ r, c, shape, color: colors[(r + c) % 3], size: 30 })
    }
  }

  const answerColor = colors[(2 + 2) % 3]
  const distractors = colors.filter((c) => c !== answerColor).concat(spareColor)
  const options = shuffle([answerColor, ...distractors]).map((color) => ({ shape, color, size: 30 }))

  return { grid, answer: { shape, color: answerColor, size: 30 }, options }
}

function buildSizeProgress() {
  const shapes = pickN(SHAPES, 3)
  const colors = pickN(COLORS, 3)
  const grid = []

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push({ r, c, shape: shapes[r], color: colors[r], size: SIZES[c] })
    }
  }

  const answerSize = SIZES[2]
  const distractorSizes = [SIZES[0], SIZES[1], 54]
  const options = shuffle([answerSize, ...distractorSizes]).map((size) => ({
    shape: shapes[2],
    color: colors[2],
    size,
  }))

  return { grid, answer: { shape: shapes[2], color: colors[2], size: answerSize }, options }
}

function buildShapeShift() {
  const color = pickRandom(COLORS)
  const shapes = pickN(SHAPES, 3)
  const spareShape = pickRandom(SHAPES.filter((s) => !shapes.includes(s)))
  const grid = []

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push({ r, c, shape: shapes[(r + c) % 3], color, size: 30 })
    }
  }

  const answerShape = shapes[(2 + 2) % 3]
  const distractors = shapes.filter((s) => s !== answerShape).concat(spareShape)
  const options = shuffle([answerShape, ...distractors]).map((shape) => ({ shape, color, size: 30 }))

  return { grid, answer: { shape: answerShape, color, size: 30 }, options }
}

const BUILDERS = {
  'color-shift': buildColorShift,
  'size-progress': buildSizeProgress,
  'shape-shift': buildShapeShift,
}

export function generateTrial(level) {
  const template = pickRandom(level.templates)
  const built = BUILDERS[template]()
  const options = built.options.map((option, index) => ({ ...option, id: index }))
  const correctId = options.findIndex(
    (option) =>
      option.shape === built.answer.shape &&
      option.color === built.answer.color &&
      option.size === built.answer.size,
  )

  return { grid: built.grid, options, correctId }
}

export function checkAnswer(trial, optionId) {
  return { correct: optionId === trial.correctId }
}

export function scoring(results) {
  const total = results.length
  const correct = results.filter((r) => r.correct).length
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  const avgReaction = total
    ? Math.round(results.reduce((sum, r) => sum + r.reactionTimeMs, 0) / total)
    : 0

  return [
    { label: 'Правильно', value: `${correct} / ${total}` },
    { label: 'Точність', value: `${accuracy}%` },
    { label: 'Середній час', value: `${avgReaction} мс` },
  ]
}
