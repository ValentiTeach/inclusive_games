import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

/**
 * Зайвий предмет: три фігури мають спільну ознаку, четверта — ні.
 *
 * «Матриці» просять продовжити правило в сітці, тут — знайти, хто з правила
 * випадає. Це різні дії: у матриці правило показують, а тут його спершу треба
 * помітити самому.
 */
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'cross', 'pentagon']
const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b', '#1c9099']
/*
 * Чотири розміри, а не три. Розмір буває не лише «тією самою» ознакою, а й
 * побічною — і тоді чотирьом фігурам треба чотири різні значення. З трьома
 * четверта фігура лишалася зовсім без розміру: помітно це не було, бо ShapeIcon
 * підставляє власне значення за замовчуванням, але ознака мовчки ламалася.
 */
const SIZES = [22, 30, 38, 46]

export const DIMENSIONS = ['shape', 'color', 'size']

export const config = {
  id: 'odd-one-out',
  title: 'Зайвий предмет',
  category: 'thinking',
  description: 'Три фігури схожі за однією ознакою, а одна — ні. Знайди зайву.',
  instructions: [
    'На екрані чотири фігури.',
    'Три з них мають спільну ознаку: форму, колір або розмір.',
    'Обери ту, що з цієї трійки випадає.',
  ],
  keyHint: { keys: '1–4', text: 'вибрати фігуру' },
  levels: [
    { id: 'color', label: 'За кольором', trialCount: 6, dimensions: ['color'] },
    { id: 'shape', label: 'Колір і форма', trialCount: 8, dimensions: ['color', 'shape'] },
    { id: 'all', label: 'Усі ознаки', trialCount: 10, dimensions: ['color', 'shape', 'size'] },
  ],
}

const POOLS = { shape: SHAPES, color: COLORS, size: SIZES }

/**
 * Яка фігура зайва за ознакою `dimension`: та єдина, чиє значення не збігається
 * з рештою. Якщо значення розподілені інакше (два на два, усі різні), за цією
 * ознакою зайвої немає.
 */
export function oddByDimension(items, dimension) {
  const counts = new Map()
  for (const item of items) {
    counts.set(item[dimension], (counts.get(item[dimension]) ?? 0) + 1)
  }
  if (counts.size !== 2) return null

  const lonely = [...counts.entries()].find(([, count]) => count === 1)
  if (!lonely) return null

  return items.find((item) => item[dimension] === lonely[0])
}

/**
 * Усі фігури, яких можна назвати зайвими хоч за якоюсь ознакою.
 *
 * Проба має рівно одну відповідь. Якщо випадково вийде, що за кольором зайва
 * одна фігура, а за розміром — інша, дитина, яка помітила друге правило, буде
 * «неправа», хоча міркувала бездоганно. Такі проби відкидаються при генерації.
 */
export function ambiguityOf(items) {
  const odd = new Set()
  for (const dimension of DIMENSIONS) {
    const item = oddByDimension(items, dimension)
    if (item) odd.add(item.id)
  }
  return [...odd]
}

function buildAttempt(level) {
  const dimension = pickRandom(level.dimensions)
  const others = DIMENSIONS.filter((name) => name !== dimension)
  const sharedValue = pickRandom(POOLS[dimension])
  const oddValue = pickRandom(POOLS[dimension].filter((value) => value !== sharedValue))

  /*
   * Решта ознак навмисно різні всередині трійки. Якби три фігури збігалися ще й
   * формою, спільною ознакою можна було б назвати будь-яку з двох, і питання
   * стало б нечітким.
   */
  const variants = others.map((name) => shuffle(POOLS[name]).slice(0, 4))
  const items = [0, 1, 2, 3].map((index) => {
    const item = { id: index, [dimension]: index === 3 ? oddValue : sharedValue }
    others.forEach((name, k) => {
      item[name] = variants[k][index]
    })
    return item
  })

  return { items: shuffle(items), dimension, oddId: 3 }
}

/*
 * Однозначність тут не перевіряється перебором, а випливає з побудови: за
 * обраною ознакою трійка збігається, а за кожною іншою всі чотири значення
 * різні, тож «три однакові й одна ні» більше ніде не складається. Перебір із
 * повторними спробами був би мертвим кодом — у 9000 проб він не спрацював
 * жодного разу. Інваріант натомість перевіряється тестом.
 */
export function generateTrial(level) {
  return buildAttempt(level)
}

export function checkAnswer(trial, itemId) {
  return { correct: itemId === trial.oddId }
}

export function scoring(results) {
  const metrics = trialMetrics(results)

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
    ],
    metrics,
  }
}
