import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Що до чого — узагальнення: віднести предмет до групи й назвати групу одним
 * словом. Основа вербального мислення і лексики, з якою логопед працює
 * щодня: «яблуко, банан, піца — це їжа».
 *
 * Кожен предмет — картинка з підписом. Підпис потрібен тому, хто читає, а для
 * того, хто ні, вистачає картинки: групи навмисно далекі одна від одної.
 */
export const GROUPS = [
  {
    id: 'animals',
    name: 'Тварини',
    icon: 'PawPrint',
    items: [
      ['Cat', 'кіт'],
      ['Dog', 'собака'],
      ['Fish', 'риба'],
      ['Bird', 'птах'],
      ['Rabbit', 'кролик'],
      ['Squirrel', 'білка'],
      ['Turtle', 'черепаха'],
      ['Snail', 'равлик'],
      ['Bug', 'жук'],
    ],
  },
  {
    id: 'transport',
    name: 'Транспорт',
    icon: 'Navigation',
    items: [
      ['Car', 'машина'],
      ['Bus', 'автобус'],
      ['Bike', 'велосипед'],
      ['Plane', 'літак'],
      ['Ship', 'корабель'],
      ['TrainFront', 'потяг'],
      ['Truck', 'вантажівка'],
      ['Tractor', 'трактор'],
      ['Helicopter', 'гелікоптер'],
      ['Sailboat', 'човен'],
    ],
  },
  {
    id: 'food',
    name: 'Їжа',
    icon: 'Utensils',
    items: [
      ['Apple', 'яблуко'],
      ['Cherry', 'вишня'],
      ['Carrot', 'морква'],
      ['Grape', 'виноград'],
      ['Banana', 'банан'],
      ['Pizza', 'піца'],
      ['Croissant', 'круасан'],
      ['Egg', 'яйце'],
      ['CakeSlice', 'торт'],
      ['Sandwich', 'бутерброд'],
      ['Soup', 'суп'],
      ['Cookie', 'печиво'],
    ],
  },
  {
    id: 'tools',
    name: 'Інструменти',
    icon: 'Toolbox',
    items: [
      ['Hammer', 'молоток'],
      ['Wrench', 'гайковий ключ'],
      ['Scissors', 'ножиці'],
      ['Ruler', 'лінійка'],
      ['Pencil', 'олівець'],
      ['Paintbrush', 'пензлик'],
      ['Shovel', 'лопата'],
      ['Axe', 'сокира'],
    ],
  },
  {
    id: 'nature',
    name: 'Природа і погода',
    icon: 'CloudSun',
    items: [
      ['Sun', 'сонце'],
      ['Moon', 'місяць'],
      ['Cloud', 'хмара'],
      ['Snowflake', 'сніжинка'],
      ['Rainbow', 'веселка'],
      ['Wind', 'вітер'],
      ['TreeDeciduous', 'дерево'],
      ['Leaf', 'листок'],
      ['Flower', 'квітка'],
      ['Mountain', 'гора'],
    ],
  },
  {
    id: 'music',
    name: 'Музика',
    icon: 'Music',
    items: [
      ['Drum', 'барабан'],
      ['Guitar', 'гітара'],
      ['Piano', 'піаніно'],
      ['Bell', 'дзвоник'],
    ],
  },
]

export const config = {
  ...gameInfo('word-groups'),
  instructions: [
    'Зверху — предмет: картинка і слово.',
    'Натисни групу, до якої він належить: тварини, транспорт, їжа…',
    'На складному рівні з чотирьох предметів знайди зайвий — той, що з іншої групи.',
  ],
  keyHint: { keys: 'Цифри', text: 'вибрати варіант за номером' },
  practice: {
    hint: (level) =>
      level.mode === 'odd'
        ? 'Три предмети — з однієї групи, один — з іншої. Знайди той, що не підходить.'
        : 'Подумай, як назвати предмет одним словом: кіт — це тварина, автобус — транспорт.',
  },
  levels: [
    { id: 'two', label: 'Дві групи', trialCount: 8, mode: 'sort', groupCount: 2 },
    { id: 'three', label: 'Три групи', trialCount: 10, mode: 'sort', groupCount: 3 },
    { id: 'odd', label: 'Четвертий зайвий', trialCount: 8, mode: 'odd' },
  ],
}

function asItem(group, [icon, word]) {
  return { icon, word, groupId: group.id }
}

/** Групи на всю гру: кошики не мають мінятися щопроби. */
export function pickGroups(level) {
  if (level.mode === 'odd') return GROUPS
  return shuffle(GROUPS).slice(0, level.groupCount)
}

export function generateTrial(level, groups, previous) {
  if (level.mode === 'odd') {
    const [main, other] = shuffle(GROUPS)
    const items = shuffle(main.items).slice(0, 3).map((item) => asItem(main, item))
    const odd = asItem(other, pickRandom(other.items))
    return { mode: 'odd', items: shuffle([...items, odd]), answer: odd.word, mainGroup: main, oddGroup: other }
  }

  const group = pickRandom(groups)
  const pool = group.items.filter(([, word]) => word !== previous?.item?.word)
  const item = asItem(group, pickRandom(pool))
  return { mode: 'sort', item, answer: group.id }
}

export function checkAnswer(trial, answer) {
  return { correct: answer === trial.answer }
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
