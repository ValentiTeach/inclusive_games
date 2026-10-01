import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Перший звук — фонематичний аналіз: почути в слові окремий звук.
 *
 * Слово показується картинкою і підписом, у якому шуканий звук закрито:
 * «_іт». Підпис знімає неоднозначність картинки (машина чи автомобіль?), а
 * закрита літера лишає саме завдання. Якщо на пристрої є український голос,
 * слово ще й звучить.
 *
 * Слова дібрано так, щоб літера на місці пропуску збігалася зі звуком: жодних
 * я, ю, є, ї, щ (два звуки однією літерою), дз, дж і м'якого знака в кінці.
 */
export const WORDS = [
  { word: 'кіт', icon: 'Cat' },
  { word: 'риба', icon: 'Fish' },
  { word: 'сонце', icon: 'Sun' },
  { word: 'зірка', icon: 'Star' },
  { word: 'квітка', icon: 'Flower' },
  { word: 'ключ', icon: 'Key' },
  { word: 'книжка', icon: 'Book' },
  { word: 'літак', icon: 'Plane' },
  { word: 'годинник', icon: 'Clock' },
  { word: 'телефон', icon: 'Phone' },
  { word: 'парасолька', icon: 'Umbrella' },
  { word: 'морква', icon: 'Carrot' },
  { word: 'вишня', icon: 'Cherry' },
  { word: 'виноград', icon: 'Grape' },
  { word: 'серце', icon: 'Heart' },
  { word: 'олівець', icon: 'Pencil' },
  { word: 'ножиці', icon: 'Scissors' },
  { word: 'молоток', icon: 'Hammer' },
  { word: 'равлик', icon: 'Snail' },
  { word: 'черепаха', icon: 'Turtle' },
  { word: 'дерево', icon: 'TreeDeciduous' },
  { word: 'листок', icon: 'Leaf' },
  { word: 'сніжинка', icon: 'Snowflake' },
  { word: 'хмара', icon: 'Cloud' },
  { word: 'гітара', icon: 'Guitar' },
  { word: 'піца', icon: 'Pizza' },
  { word: 'торт', icon: 'CakeSlice' },
  { word: 'окуляри', icon: 'Glasses' },
  { word: 'ракета', icon: 'Rocket' },
  { word: 'лампа', icon: 'Lamp' },
  { word: 'магніт', icon: 'Magnet' },
  { word: 'корона', icon: 'Crown' },
  { word: 'барабан', icon: 'Drum' },
  { word: 'велосипед', icon: 'Bike' },
  { word: 'автобус', icon: 'Bus' },
  { word: 'потяг', icon: 'TrainFront' },
  { word: 'птах', icon: 'Bird' },
  { word: 'будинок', icon: 'House' },
  { word: 'подарунок', icon: 'Gift' },
  { word: 'банан', icon: 'Banana' },
  { word: 'футболка', icon: 'Shirt' },
  { word: 'гора', icon: 'Mountain' },
  { word: 'намет', icon: 'Tent' },
  { word: 'цукерка', icon: 'Candy' },
  { word: 'кубок', icon: 'Trophy' },
  { word: 'трактор', icon: 'Tractor' },
  { word: 'човен', icon: 'Sailboat' },
  { word: 'суп', icon: 'Soup' },
  { word: 'горіх', icon: 'Nut' },
  { word: 'диван', icon: 'Sofa' },
  { word: 'вухо', icon: 'Ear' },
  { word: 'шинка', icon: 'Ham' },
  { word: 'білка', icon: 'Squirrel' },
  { word: 'жук', icon: 'Bug' },
  { word: 'сокира', icon: 'Axe' },
  { word: 'лопата', icon: 'Shovel' },
  { word: 'лінійка', icon: 'Ruler' },
  { word: 'кролик', icon: 'Rabbit' },
  { word: 'вітер', icon: 'Wind' },
  { word: 'лимон', icon: 'Citrus' },
]

/*
 * Звуки, які діти найчастіше плутають: свистячі й шиплячі, дзвінкі й глухі
 * пари, задньоязикові, сонорні. На середньому рівні хибні варіанти беруться
 * саме звідси — це і є фонематичне розрізнення, а не вгадування.
 */
export const CONFUSABLE = [
  ['с', 'з', 'ц', 'ш', 'ж', 'ч'],
  ['б', 'п'],
  ['д', 'т'],
  ['г', 'х', 'к'],
  ['в', 'ф'],
  ['м', 'н'],
  ['р', 'л'],
  ['о', 'у', 'а'],
  ['і', 'и', 'е'],
]

export const LETTERS = 'абвгдежзиіклмнопрстуфхцчш'.split('')
const CONSONANTS = 'бвгджзклмнпрстфхцчш'

export const config = {
  ...gameInfo('first-sound'),
  instructions: [
    'Подивись на картинку. Під нею — слово, у якому сховано один звук.',
    'Обери, який звук там має бути. Якщо є кнопка «Послухати слово» — натисни її.',
    'На складному рівні сховано не перший, а останній звук.',
  ],
  keyHint: { keys: '1–4', text: 'вибрати звук' },
  practice: {
    hint: (level) =>
      level.position === 'last'
        ? 'Скажи слово вголос і послухай, яким звуком воно закінчується. Кі-Т — останній звук «т».'
        : 'Скажи слово вголос і послухай перший звук. К-іт — перший звук «к».',
  },
  levels: [
    { id: 'first', label: 'Перший звук', trialCount: 8, position: 'first', options: 3, similar: false },
    { id: 'similar', label: 'Схожі звуки', trialCount: 10, position: 'first', options: 4, similar: true },
    { id: 'last', label: 'Останній звук', trialCount: 10, position: 'last', options: 4, similar: true },
  ],
}

export function soundAt(word, position) {
  const letters = word.replace(/['ʼ’]/g, '')
  return position === 'last' ? letters.at(-1) : letters[0]
}

export function maskedWord(word, position) {
  return position === 'last' ? `${word.slice(0, -1)}_` : `_${word.slice(1)}`
}

function groupOf(letter) {
  return CONFUSABLE.find((group) => group.includes(letter)) ?? [letter]
}

/** Хибні варіанти: схожі звуки, якщо рівень цього хоче, решта — будь-які. */
export function distractorsFor(answer, count, similar) {
  const group = groupOf(answer).filter((letter) => letter !== answer)
  const close = similar ? shuffle(group).slice(0, count) : []
  const far = shuffle(LETTERS.filter((letter) => !groupOf(answer).includes(letter)))
  return [...close, ...far].slice(0, count)
}

/*
 * На останній звук годяться лише слова, що закінчуються на приголосний: «риба»
 * дала б «а» в кожній другій пробі, а «вишня» чи «олівець» закінчуються
 * літерою, яка не є одним звуком.
 */
export function wordsFor(level) {
  if (level.position !== 'last') return WORDS
  return WORDS.filter(({ word }) => CONSONANTS.includes(soundAt(word, 'last')))
}

export function generateTrial(level, previous) {
  const pool = wordsFor(level).filter((entry) => entry.word !== previous?.word)
  const entry = pickRandom(pool)
  const answer = soundAt(entry.word, level.position)
  return {
    ...entry,
    answer,
    masked: maskedWord(entry.word, level.position),
    options: shuffle([answer, ...distractorsFor(answer, level.options - 1, level.similar)]),
  }
}

export function checkAnswer(trial, letter) {
  return { correct: letter === trial.answer }
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
