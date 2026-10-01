import { shuffle } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Накладені фігури (Поппельрейтер) — зорова організація: виокремити контур
 * предмета, коли поверх нього намальовано інші.
 *
 * Іконки тут — лише контури без заливки, тож накладаються вони так само, як
 * у класичних бланках: лінії перетинаються, і жоден предмет не закриває
 * інший суцільною плямою.
 */
export const FIGURES = [
  ['Apple', 'яблуко'],
  ['Bell', 'дзвоник'],
  ['Key', 'ключ'],
  ['Scissors', 'ножиці'],
  ['Umbrella', 'парасолька'],
  ['Star', 'зірка'],
  ['Heart', 'серце'],
  ['Fish', 'риба'],
  ['Cat', 'кіт'],
  ['Car', 'машина'],
  ['Clock', 'годинник'],
  ['Cloud', 'хмара'],
  ['Guitar', 'гітара'],
  ['Hammer', 'молоток'],
  ['Leaf', 'листок'],
  ['Sun', 'сонце'],
  ['Moon', 'місяць'],
  ['Crown', 'корона'],
]

export const config = {
  ...gameInfo('hidden-figures'),
  instructions: [
    'У рамці кілька предметів намальовано один поверх одного.',
    'Знайди внизу всі, що сховалися в рамці, і познач їх.',
    'Коли все знайдено — натисни «Готово».',
  ],
  keyHint: { keys: 'Цифри та Enter', text: 'позначити / готово' },
  practice: {
    hint: 'Обведи очима кожну лінію: де вона починається і де закінчується? Так видно, з яких предметів складається малюнок.',
  },
  levels: [
    { id: 'two', label: '2 предмети', trialCount: 5, hidden: 2, options: 5 },
    { id: 'three', label: '3 предмети', trialCount: 6, hidden: 3, options: 6 },
    { id: 'four', label: '4 предмети', trialCount: 6, hidden: 4, options: 8 },
  ],
}

/* Невеликий зсув кожного контуру: якби всі лягли точно один на одного, вийшла
   б нерозбірлива пляма навіть для дорослого. */
const OFFSETS = [
  [0, 0],
  [10, 6],
  [-8, 8],
  [6, -9],
]

export function generateTrial(level) {
  const pool = shuffle(FIGURES)
  const hidden = pool.slice(0, level.hidden).map(([icon, word], index) => ({
    icon,
    word,
    offset: OFFSETS[index],
  }))
  const decoys = pool.slice(level.hidden, level.options).map(([icon, word]) => ({ icon, word }))
  return {
    hidden,
    options: shuffle([...hidden.map(({ icon, word }) => ({ icon, word })), ...decoys]),
  }
}

/** Скільки знайдено, скільки пропущено, скільки вибрано зайвих. */
export function checkAnswer(trial, picked) {
  const hiddenSet = new Set(trial.hidden.map((item) => item.icon))
  const hits = [...picked].filter((icon) => hiddenSet.has(icon)).length
  const falseAlarms = picked.size - hits
  const misses = hiddenSet.size - hits
  return { correct: falseAlarms === 0 && misses === 0, hits, falseAlarms, misses }
}

export function scoring(results) {
  const sum = (key) => results.reduce((total, result) => total + result[key], 0)
  const correct = results.filter((result) => result.correct).length
  const hits = sum('hits')
  const targets = hits + sum('misses')
  const falseAlarms = sum('falseAlarms')

  const metrics = defineMetrics({
    total: results.length,
    correct,
    errors: results.length - correct,
    accuracy_pct: results.length ? Math.round((correct / results.length) * 100) : undefined,
    hits,
    targets,
    misses: sum('misses'),
    false_alarms: falseAlarms,
  })

  // Бал — частка знайдених мінус зайві: дитина, що позначила все підряд,
  // не має отримати сто.
  const score = targets ? Math.round(Math.max(0, (hits - falseAlarms) / targets) * 100) : 0

  return {
    score,
    entries: [
      { label: 'Знайдено', value: `${hits} / ${targets}` },
      { label: 'Зайвих позначок', value: String(falseAlarms) },
      { label: 'Малюнків без помилки', value: `${correct} / ${results.length}` },
    ],
    metrics,
  }
}
