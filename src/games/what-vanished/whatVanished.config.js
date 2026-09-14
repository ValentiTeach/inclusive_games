import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'

/**
 * Зорова робоча пам'ять: що саме зникло з набору.
 *
 * «Знайди пару» міряє впізнавання — картку перевертають, і треба пригадати, чи
 * бачив таку. Тут інше завдання: набір треба утримати в голові цілком, бо
 * питання ставиться про те, чого на екрані вже немає. Це та сама здатність, яка
 * дозволяє помітити, що з парти зник пенал.
 */
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'cross', 'pentagon']
const COLORS = ['#2d6bd6', '#2e8b57', '#c8862b', '#7c5cd9', '#c0392b', '#1c9099', '#d24b64', '#8a5a34']

export const OPTION_COUNT = 4

export const config = {
  id: 'what-vanished',
  title: 'Що зникло',
  category: 'memory',
  description: 'Запам’ятай предмети — один зникне, і треба сказати, який саме.',
  instructions: [
    'Спершу покажуть кілька предметів — запам’ятай їх.',
    'Потім вони зникнуть на мить і повернуться, але одного вже не буде.',
    'Обери серед варіантів той, що зник.',
  ],
  keyHint: { keys: '1–4', text: 'вибрати предмет' },
  levels: [
    { id: 'four', label: '4 предмети', trialCount: 6, setSize: 4, showMs: 2600 },
    { id: 'six', label: '6 предметів', trialCount: 8, setSize: 6, showMs: 3200 },
    { id: 'eight', label: '8 предметів', trialCount: 10, setSize: 8, showMs: 4000 },
  ],
}

/**
 * Кожен предмет — унікальна пара «форма + колір».
 *
 * Якби пари повторювалися, дитина могла б відповісти, не пам'ятаючи набору:
 * «зник синій» звучало б правильно, поки синіх двоє. Унікальність робить
 * питання чесним — на нього не можна відповісти частковою ознакою.
 */
export function generateTrial(level) {
  const shapes = shuffle(SHAPES).slice(0, level.setSize)
  const colors = shuffle(COLORS).slice(0, level.setSize)
  const items = shapes.map((shape, index) => ({
    id: index,
    shape,
    color: colors[index],
  }))

  const missing = pickRandom(items)
  const others = items.filter((item) => item.id !== missing.id)
  /*
   * Хибні варіанти беруться з того самого набору, а не вигадуються наново.
   * Чужий предмет серед варіантів видавав би себе сам: його не було на екрані,
   * і вибирати довелося б за впізнаванням, а не за пам'яттю про набір.
   */
  const distractors = shuffle(others).slice(0, OPTION_COUNT - 1)

  return {
    items,
    missingId: missing.id,
    options: shuffle([missing, ...distractors]),
  }
}

/** Набір, який показують після зникнення: той самий, мінус один предмет. */
export function remainingItems(trial) {
  return trial.items.filter((item) => item.id !== trial.missingId)
}

/**
 * Скільки колонок і рядків займає набір.
 *
 * Стала сітка на чотири колонки лишала порожній хвіст: шість предметів ставали
 * «4 + 2», а після зникнення одного — «4 + 1», і півблока висіло порожнім. Тут
 * форма підбирається так, щоб рядки були приблизно рівні.
 */
export function gridShape(setSize) {
  const columns = setSize <= 4 ? setSize : setSize % 4 === 0 ? 4 : 3
  return { columns, rows: Math.ceil(setSize / columns) }
}

export function checkAnswer(trial, optionId) {
  return { correct: optionId === trial.missingId }
}

export function scoring(results, extra = {}) {
  const metrics = trialMetrics(results, extra)

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
      { label: 'Предметів у наборі', value: String(metrics.set_size ?? 0) },
    ],
    metrics,
  }
}
