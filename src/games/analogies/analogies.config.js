import { shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Аналогії — вербальне мислення: «кролик — морква, білка — ?».
 *
 * Щоб відповісти, треба спершу назвати зв'язок у першій парі («кролик ЇСТЬ
 * моркву»), а потім перенести його на другу. Це та сама операція, що в
 * класичних «Аналогіях» з методик вербального мислення, але на картинках із
 * підписом: відповісти може й дитина, яка ще не читає.
 *
 * У кожної задачі є «приманка» (`lure`) — предмет, тісно пов'язаний із третьою
 * картинкою, але іншим зв'язком: білка — дерево. Дитина, що мислить
 * ситуативно («білка живе на дереві»), обирає саме її, і це окремий показник
 * (`lure_errors`), а не просто помилка: так видно, чи вже сформувалось
 * узагальнення за зв'язком, чи дитина ще йде за асоціацією.
 *
 * Предмет — [іконка, підпис].
 */
export const ITEMS = [
  // ── Легкі: їжа, середовище, захист, частина тіла ──
  {
    tier: 1,
    a: ['Rabbit', 'кролик'],
    b: ['Carrot', 'морква'],
    c: ['Squirrel', 'білка'],
    answer: ['Nut', 'горіх'],
    lure: ['TreeDeciduous', 'дерево'],
    others: [
      ['Hammer', 'молоток'],
      ['Car', 'машина'],
    ],
    explain: 'Кролик їсть моркву, а білка — горіхи.',
  },
  {
    tier: 1,
    a: ['Dog', 'собака'],
    b: ['Bone', 'кістка'],
    c: ['Cat', 'кіт'],
    answer: ['Fish', 'рибка'],
    lure: ['PawPrint', 'лапа'],
    others: [
      ['Umbrella', 'парасолька'],
      ['Book', 'книжка'],
    ],
    explain: 'Собака гризе кістку, а кіт їсть рибку.',
  },
  {
    tier: 1,
    a: ['Fish', 'риба'],
    b: ['Waves', 'вода'],
    c: ['Bird', 'птах'],
    answer: ['Cloud', 'небо'],
    lure: ['Egg', 'яйце'],
    others: [
      ['Pizza', 'піца'],
      ['Key', 'ключ'],
    ],
    explain: 'Риба плаває у воді, а птах літає в небі.',
  },
  {
    tier: 1,
    a: ['CloudRain', 'дощ'],
    b: ['Umbrella', 'парасолька'],
    c: ['Sun', 'сонце'],
    answer: ['Glasses', 'сонячні окуляри'],
    lure: ['Moon', 'місяць'],
    others: [
      ['Carrot', 'морква'],
      ['Bike', 'велосипед'],
    ],
    explain: 'Від дощу ховаються під парасолькою, а від сонця — за сонячними окулярами.',
  },
  {
    tier: 1,
    a: ['Eye', 'око'],
    b: ['Glasses', 'окуляри'],
    c: ['Ear', 'вухо'],
    answer: ['Headphones', 'навушники'],
    lure: ['Music', 'музика'],
    others: [
      ['Apple', 'яблуко'],
      ['Shovel', 'лопата'],
    ],
    explain: 'Окуляри надягають на очі, а навушники — на вуха.',
  },
  {
    tier: 1,
    a: ['Plane', 'літак'],
    b: ['Cloud', 'небо'],
    c: ['Ship', 'корабель'],
    answer: ['Waves', 'море'],
    lure: ['Anchor', 'якір'],
    others: [
      ['Cookie', 'печиво'],
      ['Pencil', 'олівець'],
    ],
    explain: 'Літак летить у небі, а корабель пливе морем.',
  },

  // ── Складніші: знаряддя професії, живлення, частина й ціле, розвиток ──
  {
    tier: 2,
    a: ['HardHat', 'будівельник'],
    b: ['Hammer', 'молоток'],
    c: ['ChefHat', 'кухар'],
    answer: ['CookingPot', 'каструля'],
    lure: ['Pizza', 'піца'],
    others: [
      ['Bike', 'велосипед'],
      ['Leaf', 'листок'],
    ],
    explain: 'Будівельник працює молотком, а кухар — каструлею. Піца — це те, що кухар готує, а не чим.',
  },
  {
    tier: 2,
    a: ['Car', 'машина'],
    b: ['Fuel', 'бензин'],
    c: ['Phone', 'телефон'],
    answer: ['Plug', 'зарядка'],
    lure: ['Mail', 'лист'],
    others: [
      ['Apple', 'яблуко'],
      ['Sun', 'сонце'],
    ],
    explain: 'Машину заправляють бензином, а телефон — заряджають.',
  },
  {
    tier: 2,
    a: ['Leaf', 'листок'],
    b: ['TreeDeciduous', 'дерево'],
    c: ['Feather', 'перо'],
    answer: ['Bird', 'птах'],
    lure: ['Pen', 'ручка'],
    others: [
      ['Bus', 'автобус'],
      ['Cookie', 'печиво'],
    ],
    explain: 'Листок — частина дерева, а перо — частина птаха.',
  },
  {
    tier: 2,
    a: ['Bean', 'квасолинка'],
    b: ['Sprout', 'паросток'],
    c: ['Egg', 'яйце'],
    answer: ['Bird', 'пташеня'],
    lure: ['EggFried', 'яєчня'],
    others: [
      ['Hammer', 'молоток'],
      ['Umbrella', 'парасолька'],
    ],
    explain: 'З квасолинки проростає паросток, а з яйця вилуплюється пташеня.',
  },
  {
    tier: 2,
    a: ['ThermometerSun', 'спека'],
    b: ['IceCreamCone', 'морозиво'],
    c: ['ThermometerSnowflake', 'мороз'],
    answer: ['Coffee', 'гарячий чай'],
    lure: ['Snowflake', 'сніжинка'],
    others: [
      ['Bike', 'велосипед'],
      ['Book', 'книжка'],
    ],
    explain: 'У спеку освіжає морозиво, а в мороз зігріває гарячий чай.',
  },
  {
    tier: 2,
    a: ['Microscope', 'мікроскоп'],
    b: ['Bug', 'жучок'],
    c: ['Telescope', 'телескоп'],
    answer: ['Star', 'зірка'],
    lure: ['Glasses', 'окуляри'],
    others: [
      ['Carrot', 'морква'],
      ['Shirt', 'сорочка'],
    ],
    explain: 'У мікроскоп роздивляються дуже маленьке, а в телескоп — дуже далеке.',
  },
]

export const config = {
  ...gameInfo('analogies'),
  instructions: [
    'Зверху — дві картинки, які чимось пов’язані: кролик і морква.',
    'Подумай, як саме: кролик ЇСТЬ моркву.',
    'Знизу — третя картинка. Знайди їй пару так само: білка їсть… горіхи!',
  ],
  keyHint: { keys: 'Цифри', text: 'вибрати варіант за номером' },
  practice: {
    hint: 'Спершу скажи, як пов’язані перші дві картинки. Потім знайди для третьої таку саму пару.',
  },
  levels: [
    { id: 'easy', label: 'Легкі', trialCount: 6, tiers: [1], options: 3, lure: false },
    { id: 'classic', label: 'Звичайні', trialCount: 8, tiers: [1, 2], options: 4, lure: true },
    { id: 'hard', label: 'Складні', trialCount: 6, tiers: [2], options: 4, lure: true },
  ],
}

/** Задачі на всю спробу — без повторів. */
export function pickItems(level) {
  return shuffle(ITEMS.filter((item) => level.tiers.includes(item.tier))).slice(0, level.trialCount)
}

function asOption([icon, word], kind) {
  return { icon, word, kind }
}

/**
 * Варіанти однієї задачі. На легкому рівні приманки немає: спершу дитина має
 * зрозуміти саму ідею «така сама пара», а не обходити пастку.
 */
export function generateTrial(level, item) {
  const options = [asOption(item.answer, 'answer')]
  if (level.lure) options.push(asOption(item.lure, 'lure'))
  for (const other of shuffle(item.others)) {
    if (options.length >= level.options) break
    options.push(asOption(other, 'other'))
  }
  return { item, options: shuffle(options) }
}

export function checkAnswer(trial, word) {
  const chosen = trial.options.find((option) => option.word === word)
  return { correct: chosen?.kind === 'answer', lure: chosen?.kind === 'lure' }
}

export function scoring(results, level) {
  const lures = level?.lure ? results.filter((result) => result.lure).length : undefined
  const metrics = trialMetrics(results, { lure_errors: lures })

  const entries = [
    { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
    { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
  ]
  if (Number.isFinite(lures)) {
    entries.push({ label: 'Обрано за асоціацією', value: String(lures) })
  }

  return { score: metrics.accuracy_pct ?? 0, entries, metrics }
}
