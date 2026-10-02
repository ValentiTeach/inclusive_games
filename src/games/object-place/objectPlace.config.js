import { shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { slower } from '../engine/adapt'
import { gameInfo } from '../../data/games'

/**
 * Що де лежить — пам'ять на розташування (object-location memory).
 *
 * Не «що було», а «де було»: та сама пам'ять, що дозволяє знайти свій
 * рюкзак у роздягальні чи повернути книжку на полицю. Кожен предмет —
 * окрема проба: дитина бачить предмет і показує клітинку, де він лежав.
 */
export const ITEMS = [
  ['Key', 'ключ'],
  ['Book', 'книжка'],
  ['Glasses', 'окуляри'],
  ['Clock', 'годинник'],
  ['Apple', 'яблуко'],
  ['Gift', 'подарунок'],
  ['Lamp', 'лампа'],
  ['Umbrella', 'парасолька'],
  ['Crown', 'корона'],
  ['Guitar', 'гітара'],
  ['Scissors', 'ножиці'],
  ['Backpack', 'рюкзак'],
]

export const config = {
  ...gameInfo('object-place'),
  instructions: [
    'На полиці лежать речі. Запамʼятай, де яка.',
    'Потім полиця спорожніє, і зверху зʼявлятиметься річ — покажи, де вона лежала.',
    'Запамʼятав раніше — можна натиснути «Готово», не чекаючи.',
  ],
  keyHint: { keys: '← ↑ ↓ → та Enter', text: 'вибрати клітинку' },
  practice: {
    hint: 'Спробуй назвати місце словами: «ключ — угорі ліворуч». Так запамʼятовується легше.',
    level: (level) => ({ ...level, trialCount: 1, items: 2 }),
  },
  relaxed: {
    note: 'Речі видно вдвічі довше.',
    level: (level) => ({ ...level, showMs: slower(level.showMs, 2) }),
  },
  levels: [
    { id: 'small', label: '3 речі, полиця 3×3', trialCount: 4, size: 3, items: 3, showMs: 4000 },
    { id: 'classic', label: '4 речі, полиця 4×4', trialCount: 4, size: 4, items: 4, showMs: 5000 },
    { id: 'large', label: '6 речей, полиця 4×4', trialCount: 5, size: 4, items: 6, showMs: 7000 },
  ],
}

export function generateTrial(level) {
  const cells = shuffle(Array.from({ length: level.size * level.size }, (_, i) => i)).slice(0, level.items)
  const items = shuffle(ITEMS)
    .slice(0, level.items)
    .map(([icon, word], index) => ({ icon, word, cell: cells[index] }))
  return { items, askOrder: shuffle(items.map((item) => item.icon)) }
}

export function checkAnswer(item, cell) {
  return { correct: item.cell === cell }
}

export function scoring(results) {
  const metrics = trialMetrics(results)
  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Повернуто на місце', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    ],
    metrics,
  }
}
