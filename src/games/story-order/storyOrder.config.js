import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Що спочатку — послідовність подій і причина з наслідком.
 *
 * Логопедична класика: розклади сюжетні картинки, а потім розкажи історію.
 * Тому після правильної відповіді гра показує (і, якщо є голос, промовляє)
 * історію цілим реченням — це місток до переказу, заради якого все й робиться.
 */
export const STORIES = [
  {
    id: 'plant',
    steps: [
      ['Bean', 'посадили зернятко'],
      ['Droplets', 'полили'],
      ['Sprout', 'виріс паросток'],
      ['Flower', 'розквітла квітка'],
    ],
  },
  {
    id: 'day',
    steps: [
      ['Sunrise', 'ранок'],
      ['Sun', 'день'],
      ['Sunset', 'вечір'],
      ['Moon', 'ніч'],
    ],
  },
  {
    id: 'seasons',
    steps: [
      ['Sprout', 'весна'],
      ['TreeDeciduous', 'літо'],
      ['Leaf', 'осінь'],
      ['Snowflake', 'зима'],
    ],
  },
  {
    id: 'rain',
    steps: [
      ['CloudRain', 'пішов дощ'],
      ['Umbrella', 'розкрили парасольку'],
      ['Rainbow', 'вийшла веселка'],
    ],
  },
  {
    id: 'house',
    steps: [
      ['Shovel', 'викопали яму'],
      ['BrickWall', 'звели стіни'],
      ['House', 'будинок готовий'],
    ],
  },
  {
    id: 'party',
    steps: [
      ['ShoppingBag', 'купили торт'],
      ['Flame', 'запалили свічки'],
      ['PartyPopper', 'свято!'],
    ],
  },
  {
    id: 'evening',
    steps: [
      ['Soup', 'вечеря'],
      ['Bath', 'купання'],
      ['BookOpen', 'казка'],
      ['Bed', 'сон'],
    ],
  },
  {
    id: 'morning',
    steps: [
      ['AlarmClock', 'задзвонив будильник'],
      ['ShowerHead', 'умитися'],
      ['Shirt', 'одягнутися'],
      ['Backpack', 'зібрати рюкзак'],
      ['School', 'піти до школи'],
    ],
  },
  {
    id: 'letter',
    steps: [
      ['PenLine', 'написали лист'],
      ['Mail', 'поклали в конверт'],
      ['Mailbox', 'вкинули в скриньку'],
      ['Truck', 'лист повезли'],
      ['MailOpen', 'бабуся читає лист'],
    ],
  },
  {
    id: 'soup',
    steps: [
      ['ShoppingCart', 'купили овочі'],
      ['Carrot', 'почистили моркву'],
      ['CookingPot', 'зварили суп'],
      ['Soup', 'налили в тарілку'],
      ['Smile', 'смачно!'],
    ],
  },
]

export const config = {
  ...gameInfo('story-order'),
  instructions: [
    'Картинки переплутались. Натискай їх по порядку: що було спочатку, що потім.',
    'Помилився — натисни картку ще раз, і номер зніметься.',
    'Коли все розставлено, спробуй розповісти цю історію вголос.',
  ],
  keyHint: { keys: 'Цифри', text: 'поставити наступний номер' },
  practice: {
    hint: 'Подумай: що мало статися першим, щоб усе інше могло відбутися? Натисни це першим.',
    level: (level) => ({ ...level, trialCount: 2 }),
  },
  levels: [
    { id: 'three', label: '3 картинки', trialCount: 5, steps: 3 },
    { id: 'four', label: '4 картинки', trialCount: 5, steps: 4 },
    { id: 'five', label: '5 картинок', trialCount: 4, steps: 5 },
  ],
}

/*
 * Довша історія годиться й для коротшого рівня — її початок теж послідовний.
 * Навпаки — ні, тож на рівень беруться лише історії, де кроків вистачає.
 */
export function storiesFor(level) {
  return STORIES.filter((story) => story.steps.length >= level.steps)
}

export function generateTrial(level, previous) {
  const pool = storiesFor(level).filter((story) => story.id !== previous?.id)
  const story = pickRandom(pool.length ? pool : storiesFor(level))
  const steps = story.steps.slice(0, level.steps).map(([icon, label], rank) => ({
    id: `${story.id}-${rank}`,
    icon,
    label,
    rank,
  }))
  return { id: story.id, steps, items: shuffle(steps) }
}

export function correctOrder(trial) {
  return trial.steps.map((step) => step.id)
}

export function storyText(trial) {
  const text = trial.steps.map((step) => step.label).join(', потім ')
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/!$/, '') + '.'
}

export function checkAnswer(trial, order) {
  const expected = correctOrder(trial)
  return { correct: order.every((id, index) => expected[index] === id) && order.length === expected.length }
}

export function scoring(results) {
  const metrics = trialMetrics(results)
  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Історій розставлено', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    ],
    metrics,
  }
}
