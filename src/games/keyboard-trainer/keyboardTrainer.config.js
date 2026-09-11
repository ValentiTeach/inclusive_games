import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

/**
 * Українська розкладка ЙЦУКЕН — єдине джерело правди для всієї гри: з неї
 * будується і те, що треба набрати, і екранна клавіатура, і зіставлення
 * фізичних клавіш.
 *
 * Код клавіші поруч із літерою навмисно. `event.key` дає символ, який видає
 * поточна розкладка системи: якщо на шкільному комп'ютері стоїть англійська,
 * та сама фізична клавіша поверне «f» замість «а». За кодом ми впізнаємо
 * правильний палець навіть тоді — і підкажемо дитині, що розкладка не та,
 * замість того щоб мовчки рахувати помилки.
 *
 * Ґ і апостроф не входять: на різних розкладках вони лежать по-різному, і
 * тренувати те, що в половини дітей буде не там, — гірше, ніж не тренувати.
 */
export const KEYBOARD_ROWS = [
  [
    ['KeyQ', 'й'], ['KeyW', 'ц'], ['KeyE', 'у'], ['KeyR', 'к'], ['KeyT', 'е'], ['KeyY', 'н'],
    ['KeyU', 'г'], ['KeyI', 'ш'], ['KeyO', 'щ'], ['KeyP', 'з'], ['BracketLeft', 'х'],
    ['BracketRight', 'ї'],
  ],
  [
    ['KeyA', 'ф'], ['KeyS', 'і'], ['KeyD', 'в'], ['KeyF', 'а'], ['KeyG', 'п'], ['KeyH', 'р'],
    ['KeyJ', 'о'], ['KeyK', 'л'], ['KeyL', 'д'], ['Semicolon', 'ж'], ['Quote', 'є'],
  ],
  [
    ['KeyZ', 'я'], ['KeyX', 'ч'], ['KeyC', 'с'], ['KeyV', 'м'], ['KeyB', 'и'], ['KeyN', 'т'],
    ['KeyM', 'ь'], ['Comma', 'б'], ['Period', 'ю'],
  ],
]

/** Домашній ряд — той, на якому лежать пальці в сліпому наборі. */
export const HOME_ROW = KEYBOARD_ROWS[1].map(([, letter]) => letter)

export const ALL_LETTERS = KEYBOARD_ROWS.flat().map(([, letter]) => letter)

const LETTER_BY_CODE = new Map(KEYBOARD_ROWS.flat())

/** Літера, яку ця фізична клавіша дає в українській розкладці. */
export function letterForCode(code) {
  return LETTER_BY_CODE.get(code) ?? null
}

const WORDS = [
  'кіт', 'сонце', 'вода', 'мама', 'риба', 'зима', 'книга', 'стіл',
  'вікно', 'дерево', 'місто', 'поле', 'ліс', 'день', 'рука',
]

export const config = {
  id: 'keyboard-trainer',
  title: 'Клавіатурний тренажер',
  // Не «увага», а «реакція»: тут вимірюється швидкість руху пальця до
  // потрібної клавіші, а не утримання уваги. Заразом це друга гра в
  // категорії, яка досі трималася на одній.
  category: 'reaction',
  description: 'Знайди на клавіатурі потрібну літеру. Підказка показує, де вона.',
  instructions: [
    'Зверху показано, що треба набрати, а на екранній клавіатурі світиться потрібна клавіша.',
    'Натисни її на своїй клавіатурі — або торкнись підказки, якщо ти з телефона чи планшета.',
    'Спершу домашній ряд, далі всі літери, а тоді цілі слова.',
  ],
  keyHint: { keys: 'Літери', text: 'набрати те, що світиться' },
  levels: [
    { id: 'home', label: 'Домашній ряд', trialCount: 12, source: 'home' },
    { id: 'letters', label: 'Усі літери', trialCount: 18, source: 'letters' },
    { id: 'words', label: 'Слова', trialCount: 10, source: 'words' },
  ],
}

/**
 * Проба — це завжди рядок: одна літера на перших рівнях, ціле слово на
 * третьому. Один шлях у коді замість двох, і поле набору однакове.
 */
export function generateTrial(level, previous = null) {
  if (level.source === 'words') {
    let word = pickRandom(WORDS)
    // Два однакових слова поспіль виглядають як помилка гри.
    while (WORDS.length > 1 && word === previous) word = pickRandom(WORDS)
    return { text: word }
  }

  const pool = level.source === 'home' ? HOME_ROW : ALL_LETTERS
  let letter = pickRandom(pool)
  while (pool.length > 1 && letter === previous) letter = pickRandom(pool)
  return { text: letter }
}

/** Перемішаний набір літер рівня — для тренування без повторів поспіль. */
export function lettersOfLevel(level) {
  return shuffle(level.source === 'home' ? [...HOME_ROW] : [...ALL_LETTERS])
}

export function scoring(results) {
  const metrics = trialMetrics(results, {
    chars: results.length,
    cpm: charactersPerMinute(results),
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Символів за хвилину', value: String(metrics.cpm ?? 0) },
    ],
    metrics,
  }
}

/**
 * Символів за хвилину — головна мірка будь-якого тренажера. Рахується за сумою
 * часів між натисканнями, а не за годинником від початку гри: пауза, коли
 * дитина відвернулась, інакше з'їдала б увесь результат.
 */
function charactersPerMinute(results) {
  const times = results.map((result) => result.reactionTimeMs).filter(Number.isFinite)
  if (times.length === 0) return undefined

  const totalMs = times.reduce((sum, value) => sum + value, 0)
  if (totalMs === 0) return undefined

  return Math.round((times.length / totalMs) * 60000)
}
