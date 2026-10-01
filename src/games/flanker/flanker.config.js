import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Рибки — проба Еріксена (Flanker) у дитячій обгортці, як у NIH Toolbox.
 *
 * Посередині рибка пливе вліво чи вправо, сусідки — так само (узгоджено) або
 * навпаки (конфлікт). Головне число тут не точність, а «ефект конфлікту»:
 * на скільки мілісекунд дитина відповідає повільніше, коли сусідки
 * заважають. Що він менший — то краще вона відсіює зайве.
 */
export const DIRECTIONS = ['left', 'right']

export const config = {
  ...gameInfo('flanker'),
  instructions: [
    'На екрані — зграйка рибок. Дивись лише на ту, що посередині.',
    'Натисни стрілку туди, куди пливе середня рибка.',
    'Сусідки іноді пливуть навпаки — не дай їм тебе збити.',
  ],
  keyHint: { keys: '← / →', text: 'куди пливе середня рибка' },
  practice: {
    hint: 'Дивись тільки на рибку посередині. Пливе вліво — тисни ←, вправо — тисни →. Сусідок не слухай.',
  },
  levels: [
    { id: 'short', label: '12 зграйок', trialCount: 12, flankers: 2, jitter: false },
    { id: 'classic', label: '20 зграйок', trialCount: 20, flankers: 2, jitter: false },
    // Зграйка з'являється то вище, то нижче: дитина не може заздалегідь
    // «прицілитися» поглядом у середину, і вибіркова увага працює чесно.
    { id: 'moving', label: 'Зграйки скачуть', trialCount: 24, flankers: 3, jitter: true },
  ],
}

export function generateTrial(level, random = Math.random) {
  const target = random() < 0.5 ? 'left' : 'right'
  const congruent = random() < 0.5
  const other = target === 'left' ? 'right' : 'left'
  return {
    target,
    congruent,
    fish: [
      ...Array(level.flankers).fill(congruent ? target : other),
      target,
      ...Array(level.flankers).fill(congruent ? target : other),
    ],
    offset: level.jitter ? pickRandom([-1, 0, 1]) : 0,
  }
}

export function checkAnswer(trial, direction) {
  return { correct: direction === trial.target }
}

function meanRt(results) {
  const times = results.filter((r) => r.correct && Number.isFinite(r.reactionTimeMs))
  if (!times.length) return undefined
  return times.reduce((sum, r) => sum + r.reactionTimeMs, 0) / times.length
}

/**
 * Ефект конфлікту — різниця середнього часу правильних відповідей на
 * неузгоджених і узгоджених пробах. Лише правильних: помилкова відповідь
 * часто швидка саме тому, що дитина піддалася сусідкам.
 */
export function conflictEffect(results) {
  const incongruent = meanRt(results.filter((r) => r.congruent === false))
  const congruent = meanRt(results.filter((r) => r.congruent === true))
  if (incongruent === undefined || congruent === undefined) return undefined
  return Math.round(incongruent - congruent)
}

export function scoring(results) {
  const metrics = trialMetrics(results, { conflict_ms: conflictEffect(results) })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
      {
        label: 'Ефект конфлікту',
        value: Number.isFinite(metrics.conflict_ms) ? `${metrics.conflict_ms} мс` : '—',
      },
    ],
    metrics,
  }
}
