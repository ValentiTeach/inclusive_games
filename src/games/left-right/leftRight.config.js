import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Ліво і право — просторова орієнтація за сходинками Піаже й пробою Геда.
 *
 * 1. «Від себе» — де предмет відносно будиночка, з погляду самої дитини.
 * 2. «Спиною до тебе» — у якій руці кулька в дитини, що стоїть спиною: її
 *    права рука з того самого боку, що й твоя. Це ще «від себе».
 * 3. «Обличчям до тебе» — та сама дитина, але дивиться на тебе: її права
 *    рука навпроти твоєї лівої. Треба подумки стати на її місце — і саме тут
 *    найбільше помилок у дітей молодшого шкільного віку.
 * 4. «Упереміш» — спиною і обличчям навперемінно, без попередження.
 *
 * Помилки на дзеркальних пробах лічаться окремо (`mirror_errors`): дитина,
 * що безпомилково каже «від себе», але плутає в дзеркалі, — це зовсім інша
 * картина, ніж та, що плутає ліво й право взагалі.
 */

export const SIDES = ['left', 'right']

/* Предмети біля будиночка: ім'я — у називному відмінку, для питання «Де …?». */
export const SCENE_OBJECTS = [
  ['Apple', 'яблуко'],
  ['Star', 'зірочка'],
  ['Fish', 'рибка'],
  ['Car', 'машинка'],
  ['Flower', 'квітка'],
  ['Cat', 'кіт'],
  ['Dog', 'собака'],
  ['Bike', 'велосипед'],
  ['TreeDeciduous', 'дерево'],
  ['Umbrella', 'парасолька'],
]

/* Найдовша серія однакових відповідей поспіль: інакше «тисни ліву» вгадувало б. */
const MAX_RUN = 3

export const config = {
  ...gameInfo('left-right'),
  instructions: [
    'Подивись на картинку і відповідай: ліворуч чи праворуч, ліва рука чи права.',
    'Коли дитина на картинці стоїть спиною, її руки там само, де твої.',
    'Коли вона дивиться на тебе — усе навпаки, як у дзеркалі. Уяви, що ти стоїш на її місці.',
  ],
  keyHint: { keys: '1 / 2 або ← / →', text: 'ліва / права' },
  practice: {
    hint: (level) =>
      ({
        self: 'Подивись, з якого боку від будиночка предмет: з боку твоєї лівої руки чи правої.',
        back: 'Дитина стоїть спиною до тебе — її права рука з того самого боку, що й твоя права.',
        front: 'Дитина дивиться на тебе — її права рука навпроти твоєї лівої. Уяви, що ти стоїш так само.',
        mixed: 'Спершу подивись, як стоїть дитина: спиною (видно рюкзак) чи обличчям (видно очі).',
      })[level.id],
  },
  levels: [
    { id: 'self', label: 'Від себе', trialCount: 10, modes: ['scene'] },
    { id: 'back', label: 'Спиною до тебе', trialCount: 10, modes: ['back'] },
    { id: 'front', label: 'Обличчям до тебе', trialCount: 10, modes: ['front'] },
    { id: 'mixed', label: 'Упереміш', trialCount: 12, modes: ['back', 'front'] },
  ],
}

function opposite(side) {
  return side === 'left' ? 'right' : 'left'
}

/**
 * З якого боку екрана видно руку дитини. Спиною — там само, де в того, хто
 * дивиться; обличчям — навпаки.
 */
export function screenSide(mode, hand) {
  return mode === 'front' ? opposite(hand) : hand
}

/**
 * Одна проба. `answer` — правильна відповідь із погляду, про який питають:
 * для сцени — бік від будиночка, для дитини — її власна рука.
 */
export function generateTrial(level, history = []) {
  const mode = pickRandom(level.modes)

  const recent = history.slice(-MAX_RUN).map((trial) => trial.answer)
  const forced = recent.length === MAX_RUN && recent.every((side) => side === recent[0])
  const answer = forced ? opposite(recent[0]) : pickRandom(SIDES)

  if (mode === 'scene') {
    const previous = history.at(-1)?.object?.word
    const pool = SCENE_OBJECTS.filter(([, word]) => word !== previous)
    const [icon, word] = pickRandom(pool)
    return { mode, answer, side: answer, object: { icon, word } }
  }

  return { mode, answer, side: screenSide(mode, answer) }
}

export function checkAnswer(trial, response) {
  return { correct: response === trial.answer }
}

/** Пояснення після помилки: саме те правило, яке дитина щойно порушила. */
export function explain(trial) {
  if (trial.mode === 'scene') {
    return `${capitalize(trial.object.word)} — ${trial.answer === 'left' ? 'ліворуч' : 'праворуч'} від будиночка.`
  }
  const hand = trial.answer === 'left' ? 'лівій' : 'правій'
  if (trial.mode === 'back') {
    return `Кулька в ${hand} руці. Дитина стоїть спиною — її руки з того самого боку, що й твої.`
  }
  return `Кулька в ${hand} руці. Дитина дивиться на тебе — її права рука навпроти твоєї лівої, як у дзеркалі.`
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function scoring(results) {
  const mirrored = results.filter((result) => result.mode === 'front')
  const metrics = trialMetrics(results, {
    mirror_errors: mirrored.length ? mirrored.filter((result) => !result.correct).length : undefined,
  })

  const entries = [
    { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
    { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
  ]
  if (mirrored.length) {
    entries.push({ label: 'Помилок, коли дитина обличчям', value: `${metrics.mirror_errors} з ${mirrored.length}` })
  }

  return { score: metrics.accuracy_pct ?? 0, entries, metrics }
}
