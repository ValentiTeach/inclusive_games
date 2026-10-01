import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Від меншого до більшого — серіація: впорядкувати за ознакою.
 *
 * Одна з базових логічних операцій, на якій тримається і лічба, і розуміння
 * часу. Три види рядів: за розміром (бачиш одразу), за кількістю (треба
 * порівняти) і за часом доби (треба знати, що після чого буває).
 */
export const TIMES_OF_DAY = [
  { id: 'morning', icon: 'Sunrise', label: 'ранок' },
  { id: 'day', icon: 'Sun', label: 'день' },
  { id: 'evening', icon: 'Sunset', label: 'вечір' },
  { id: 'night', icon: 'Moon', label: 'ніч' },
]

export const config = {
  ...gameInfo('seriation'),
  instructions: [
    'Натискай предмети по черзі: спершу найменший, потім більший — і так до найбільшого.',
    'Кожне натискання ставить номер. Помилився — натисни картку ще раз, і номер зніметься.',
    'Далі будуть ряди за кількістю й за часом доби: від ранку до ночі.',
  ],
  keyHint: { keys: 'Цифри', text: 'поставити наступний номер' },
  practice: {
    hint: 'Знайди найменший і натисни його першим. Потім — той, що трохи більший. Останнім — найбільший.',
    level: (level) => ({ ...level, trialCount: 2, count: 3 }),
  },
  levels: [
    { id: 'size', label: 'За розміром', trialCount: 5, kinds: ['size'], count: 4 },
    { id: 'count', label: 'За кількістю', trialCount: 6, kinds: ['size', 'count'], count: 5 },
    { id: 'mixed', label: 'Розмір, кількість, час', trialCount: 6, kinds: ['size', 'count', 'time'], count: 5 },
  ],
}

const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b']

/**
 * Різні значення з запасом між сусідами, щоб різницю було видно оком.
 *
 * Не «тягнемо навмання, поки не підійде»: так генератор міг загнати себе в
 * глухий кут (усі місця вже заблоковані сусідами) і крутитися вічно. Тут
 * спершу береться `count` випадкових точок у звуженому діапазоні, а потім
 * кожна наступна відсувається на `gap` — запас гарантований одразу.
 */
export function spread(count, min, max, gap) {
  const room = max - min - gap * (count - 1)
  const offsets = Array.from({ length: count }, () => Math.floor(Math.random() * (room + 1))).sort(
    (a, b) => a - b,
  )
  return offsets.map((offset, index) => min + offset + gap * index)
}

export function generateTrial(level, previous) {
  const kinds = level.kinds.length > 1 ? level.kinds.filter((kind) => kind !== previous?.kind) : level.kinds
  const kind = pickRandom(kinds)

  if (kind === 'time') {
    return { kind, items: shuffle(TIMES_OF_DAY.map((item, rank) => ({ ...item, rank }))), prompt: 'Від ранку до ночі' }
  }

  const color = pickRandom(COLORS)
  if (kind === 'count') {
    const values = spread(level.count, 1, 10, 1)
    return {
      kind,
      prompt: 'Від найменшої кількості до найбільшої',
      items: shuffle(values.map((value) => ({ id: `c${value}`, value, color, label: `${value} крапок` }))),
    }
  }

  const values = spread(level.count, 24, 92, 12)
  return {
    kind,
    prompt: 'Від найменшого до найбільшого',
    items: shuffle(values.map((value) => ({ id: `s${value}`, value, color, label: `коло розміром ${value}` }))),
  }
}

/** Правильний порядок id. */
export function correctOrder(trial) {
  const key = trial.kind === 'time' ? 'rank' : 'value'
  return [...trial.items].sort((a, b) => a[key] - b[key]).map((item) => item.id)
}

export function checkAnswer(trial, order) {
  const expected = correctOrder(trial)
  const placed = order.filter((id, index) => expected[index] === id).length
  return { correct: placed === expected.length, placed }
}

export function scoring(results) {
  const metrics = trialMetrics(results)
  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Рядів без помилки', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    ],
    metrics,
  }
}
