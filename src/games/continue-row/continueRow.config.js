import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

/**
 * Продовж ряд: знайти правило послідовності й назвати наступний елемент.
 *
 * «Матриці» ховають правило в сітці 3×3, де воно читається по рядках і
 * стовпцях одразу. Тут правило одновимірне, зате його треба протягнути на крок
 * уперед, а не підставити відсутню клітинку між уже відомими сусідами.
 */
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon']
const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b', '#1c9099']
const SIZES = [22, 30, 38, 46]

export const config = {
  id: 'continue-row',
  title: 'Продовж ряд',
  category: 'thinking',
  description: 'Фігури стоять за правилом — обери ту, що має бути наступною.',
  instructions: [
    'Подивись на ряд і знайди, за яким правилом він побудований.',
    'Це може бути чергування кольорів, форм або зростання розміру.',
    'Обери серед варіантів фігуру, яка продовжує ряд.',
  ],
  keyHint: { keys: '1–4', text: 'вибрати фігуру' },
  levels: [
    { id: 'easy', label: 'Чергування', trialCount: 6, rules: ['color-cycle', 'shape-cycle'], length: 5 },
    {
      id: 'classic',
      label: 'Чергування і розмір',
      trialCount: 8,
      rules: ['color-cycle', 'shape-cycle', 'size-grow'],
      length: 5,
    },
    {
      id: 'hard',
      label: 'Складні правила',
      trialCount: 10,
      rules: ['color-cycle', 'shape-cycle', 'size-grow', 'pair-cycle'],
      length: 6,
    },
  ],
}

/**
 * Кожне правило — це функція «яким буде елемент під номером i».
 *
 * Так ряд і відповідь беруться з одного джерела: наступний елемент — це той
 * самий виклик із наступним номером. Якби відповідь будувалася окремо, вона
 * могла б розійтися з рядом, і дитина була б права, а гра — ні.
 */
const RULES = {
  /*
   * Чотири кольори в колі, а не три. Із трьох у ряду всього три різні фігури,
   * і четвертий варіант відповіді нізвідки взяти, крім кольору, якого дитина не
   * бачила, — а такий варіант відкидається без розуміння правила. Виміряно: з
   * трьома значеннями 4309 проб із 6000 виходили з трьома варіантами.
   */
  'color-cycle': () => {
    const colors = shuffle(COLORS).slice(0, 4)
    const shape = pickRandom(SHAPES)
    const size = pickRandom(SIZES)
    return (index) => ({ shape, color: colors[index % colors.length], size })
  },
  // Форми по колу за сталого кольору — теж чотири, з тієї самої причини.
  'shape-cycle': () => {
    const shapes = shuffle(SHAPES).slice(0, 4)
    const color = pickRandom(COLORS)
    const size = pickRandom(SIZES)
    return (index) => ({ shape: shapes[index % shapes.length], color, size })
  },
  // Розмір росте і починається спочатку.
  'size-grow': () => {
    const shape = pickRandom(SHAPES)
    const color = pickRandom(COLORS)
    return (index) => ({ shape, color, size: SIZES[index % SIZES.length] })
  },
  // Пари: дві однакові, потім дві інші.
  'pair-cycle': () => {
    const colors = shuffle(COLORS).slice(0, 2)
    const shapes = shuffle(SHAPES).slice(0, 2)
    const size = pickRandom(SIZES)
    return (index) => {
      const pair = Math.floor(index / 2) % 2
      return { shape: shapes[pair], color: colors[pair], size }
    }
  },
}

export const RULE_IDS = Object.keys(RULES)

export function sameItem(a, b) {
  return a.shape === b.shape && a.color === b.color && a.size === b.size
}

/**
 * Хибні варіанти будуються з матеріалу самого ряду, а не з випадкових фігур.
 *
 * Випадкова фігура видає себе кольором чи формою, якої в ряду не було: вибрати
 * правильну можна, не розібравшись у правилі, — просто відкинувши чужу.
 *
 * Спершу беруться сусідні кроки того самого ряду: вони виглядають доречно всі,
 * і відповісти можна лише зрозумівши, який крок наступний. Але цього не завжди
 * вистачає: у правила «пари» станів усього два, у чергування кольорів — три.
 * Виміряно на 9000 пробах: 524 проби виходили з двома варіантами, тобто з
 * половиною шансу вгадати. Тому решта добирається з ознак, які вже були в ряду.
 */
export function buildOptions(step, answerIndex, sequence) {
  const answer = step(answerIndex)
  const options = [answer]

  const add = (candidate) => {
    if (options.length >= 4) return
    if (options.some((option) => sameItem(option, candidate))) return
    options.push(candidate)
  }

  for (const offset of [1, -1, 2, -2, 3]) {
    if (answerIndex + offset >= 0) add(step(answerIndex + offset))
  }

  // Добір: та сама відповідь, але одна ознака взята з іншого місця ряду.
  for (const property of ['color', 'shape', 'size']) {
    for (const item of sequence) {
      if (item[property] !== answer[property]) add({ ...answer, [property]: item[property] })
    }
  }

  return options
}

export function generateTrial(level) {
  const ruleId = pickRandom(level.rules)
  const step = RULES[ruleId]()
  const sequence = Array.from({ length: level.length }, (_, index) => step(index))
  const options = buildOptions(step, level.length, sequence).map((item, index) => ({
    ...item,
    id: index,
  }))
  const answer = step(level.length)
  const correctId = options.find((option) => sameItem(option, answer)).id

  return { ruleId, sequence, options: shuffle(options), correctId }
}

export function checkAnswer(trial, optionId) {
  return { correct: optionId === trial.correctId }
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
