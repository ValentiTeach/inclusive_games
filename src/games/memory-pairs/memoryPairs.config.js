import { shuffle } from '../engine/random'
import { clampScore } from '../engine/score'

export const SYMBOLS = [
  { id: 'circle-blue', shape: 'circle', color: '#2d6bd6' },
  { id: 'square-green', shape: 'square', color: '#2e8b57' },
  { id: 'triangle-amber', shape: 'triangle', color: '#c8862b' },
  { id: 'diamond-violet', shape: 'diamond', color: '#7c5cd9' },
  { id: 'star-red', shape: 'star', color: '#c0392b' },
  { id: 'hexagon-teal', shape: 'hexagon', color: '#1c9099' },
  { id: 'cross-coral', shape: 'cross', color: '#d24b64' },
  { id: 'pentagon-brown', shape: 'pentagon', color: '#8a5a34' },
  { id: 'circle-green', shape: 'circle', color: '#2e8b57' },
  { id: 'square-violet', shape: 'square', color: '#7c5cd9' },
  { id: 'triangle-teal', shape: 'triangle', color: '#1c9099' },
  { id: 'diamond-red', shape: 'diamond', color: '#c0392b' },
]

export const config = {
  id: 'memory-pairs',
  title: 'Знайди пару',
  category: 'memory',
  description: 'Відкривай картки по дві й запам’ятовуй, де яка фігура — знайди всі пари.',
  instructions: [
    'Натисни на картку, щоб перевернути її.',
    'Відкрий другу картку — якщо фігури однакові, пара залишиться відкритою.',
    'Якщо фігури різні, обидві картки перевернуться назад. Запамʼятовуй, де що лежить.',
  ],
  levels: [
    { id: 'small', label: '6 пар', pairs: 6, columns: 4 },
    { id: 'classic', label: '8 пар', pairs: 8, columns: 4 },
    { id: 'large', label: '12 пар', pairs: 12, columns: 6 },
  ],
}

export function generateTrial(level) {
  const chosen = SYMBOLS.slice(0, level.pairs)
  const cards = shuffle(
    [...chosen, ...chosen].map((symbol, index) => ({
      uid: index,
      symbolId: symbol.id,
    })),
  )
  return { cards, columns: level.columns }
}

export function checkAnswer(cardA, cardB) {
  return { correct: cardA.symbolId === cardB.symbolId }
}

export function scoring({ moves, elapsedMs, pairs }) {
  const seconds = elapsedMs / 1000
  const score = clampScore(100 - (moves - pairs) * 5)

  return {
    score,
    entries: [
      { label: 'Ходи', value: String(moves) },
      { label: 'Час', value: `${seconds.toFixed(1)} с` },
      { label: 'Пар знайдено', value: `${pairs} / ${pairs}` },
    ],
  }
}
