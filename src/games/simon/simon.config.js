import { pickRandom } from '../engine/random'

export const PADS = [
  { id: 'red', label: 'Червона', hex: '#c0392b' },
  { id: 'blue', label: 'Синя', hex: '#2d6bd6' },
  { id: 'green', label: 'Зелена', hex: '#2e8b57' },
  { id: 'yellow', label: 'Жовта', hex: '#c8862b' },
]

export const config = {
  id: 'simon',
  title: 'Simon / Корсі',
  category: 'memory',
  description: 'Запам’ятай і повтори послідовність спалахів — щоразу вона стає на крок довшою.',
  instructions: [
    'Дивись, які кнопки спалахують по черзі.',
    'Коли показ закінчиться, повтори послідовність у тому самому порядку.',
    'З кожним успішним раундом послідовність стає на один крок довшою.',
  ],
  levels: [
    { id: 'short', label: 'До 6 кроків', targetLength: 6 },
    { id: 'classic', label: 'До 10 кроків', targetLength: 10 },
    { id: 'long', label: 'До 15 кроків', targetLength: 15 },
  ],
}

export function extendSequence(previousSequence) {
  return [...previousSequence, pickRandom(PADS).id]
}

export function checkAnswer(sequence, inputIndex, padId) {
  return { correct: sequence[inputIndex] === padId }
}

export function scoring({ roundsCompleted, targetLength }) {
  const success = roundsCompleted >= targetLength
  return [
    { label: 'Пройдено раундів', value: String(roundsCompleted) },
    { label: 'Ціль рівня', value: String(targetLength) },
    {
      label: 'Результат',
      value: success ? 'Ціль досягнута' : `Помилка на кроці ${roundsCompleted + 1}`,
    },
  ]
}
