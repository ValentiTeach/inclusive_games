import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * «День–Ніч» — Струп для тих, хто не читає.
 *
 * Тест Струпа вимагає двох умінь, які до уваги стосунку не мають: читати і
 * розрізняти кольори. Тут конфлікт той самий — бачиш одне, відповідаєш
 * протилежне, — але тримається він на двох картинках, які знає кожна дитина
 * з трьох років. Класична проба на гальмування в дошкільному віці.
 */
export const PICTURES = ['sun', 'moon']

export const ANSWERS = [
  { id: 'day', label: 'День', picture: 'sun' },
  { id: 'night', label: 'Ніч', picture: 'moon' },
]

export const config = {
  ...gameInfo('day-night'),
  instructions: [
    'На екрані зʼявиться сонце або місяць.',
    'Побачив сонце — тисни «Ніч». Побачив місяць — тисни «День». Навпаки!',
    'На складному рівні над картинкою буде знак: ⇄ — відповідай навпаки, = — так само.',
  ],
  keyHint: { keys: '1 / 2', text: 'День / Ніч' },
  practice: {
    hint: (level) =>
      level.mode === 'mixed'
        ? 'Стрілки ⇄ — тисни навпаки: на сонце «Ніч». Знак = — тисни те, що бачиш: на сонце «День».'
        : 'Сонце — тисни «Ніч». Місяць — тисни «День». Усе навпаки!',
  },
  levels: [
    { id: 'inverse', label: 'Навпаки', trialCount: 12, mode: 'inverse' },
    { id: 'long', label: 'Навпаки, довше', trialCount: 20, mode: 'inverse' },
    { id: 'mixed', label: 'Правило змінюється', trialCount: 16, mode: 'mixed' },
  ],
}

/*
 * На змішаному рівні «навпаки» трапляється частіше за «так само»: інакше
 * дитина не встигала б звикнути до правила, яке треба долати, і конфлікту
 * не було б.
 */
const INVERSE_SHARE = 0.6

export function generateTrial(level, random = Math.random) {
  const rule = level.mode === 'mixed' && random() >= INVERSE_SHARE ? 'same' : 'inverse'
  return { picture: pickRandom(PICTURES), rule }
}

export function expectedAnswer(trial) {
  const same = ANSWERS.find((answer) => answer.picture === trial.picture)
  if (trial.rule === 'same') return same.id
  return ANSWERS.find((answer) => answer.id !== same.id).id
}

export function checkAnswer(trial, answerId) {
  return { correct: answerId === expectedAnswer(trial) }
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
