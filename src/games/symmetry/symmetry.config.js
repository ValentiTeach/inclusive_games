import { shuffle } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Симетрія — домалювати другу половину візерунка, як у дзеркалі.
 *
 * Дзеркальність — саме те, на чому діти плутають «б» і «д», «Е» і «Є»: ліве
 * треба відобразити вправо, а не скопіювати. Помилка «скопіював замість
 * віддзеркалити» тут видна одразу — клітинки стоять не на своїх місцях.
 */
export const config = {
  ...gameInfo('symmetry'),
  instructions: [
    'Ліворуч від лінії — половина візерунка.',
    'Зафарбуй клітинки праворуч так, щоб вийшло дзеркальне відображення.',
    'Коли готово — натисни «Перевірити».',
  ],
  keyHint: { keys: '← ↑ ↓ →, Пробіл, Enter', text: 'рух / зафарбувати / перевірити' },
  practice: {
    hint: 'Клітинка біля лінії відображається теж біля лінії. Дальня від лінії — теж дальня.',
    level: (level) => ({ ...level, trialCount: 1, filled: 2 }),
  },
  levels: [
    { id: 'small', label: 'Половина 3 × 4', trialCount: 4, cols: 3, rows: 4, filled: 4 },
    { id: 'classic', label: 'Половина 4 × 5', trialCount: 5, cols: 4, rows: 5, filled: 7 },
    { id: 'large', label: 'Половина 5 × 6', trialCount: 5, cols: 5, rows: 6, filled: 11 },
  ],
}

/** Клітинка половини — рядок і стовпець від лінії симетрії (0 — біля лінії). */
export function key(row, col) {
  return `${row}:${col}`
}

export function generateTrial(level) {
  const all = []
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) all.push(key(row, col))
  }
  return { pattern: new Set(shuffle(all).slice(0, level.filled)) }
}

/**
 * Права половина зберігається в тих самих координатах — «стовпець від
 * лінії», — тож дзеркальність означає просто однакові множини. Відображення
 * робить малюнок (ліва половина малюється справа наліво).
 */
export function checkAnswer(trial, painted) {
  const hits = [...painted].filter((cell) => trial.pattern.has(cell)).length
  const extra = painted.size - hits
  const missed = trial.pattern.size - hits
  return { correct: extra === 0 && missed === 0, hits, extra, missed }
}

export function scoring(results) {
  const sum = (field) => results.reduce((total, r) => total + r[field], 0)
  const correct = results.filter((r) => r.correct).length
  const targets = sum('hits') + sum('missed')

  const metrics = defineMetrics({
    total: results.length,
    correct,
    errors: results.length - correct,
    accuracy_pct: results.length ? Math.round((correct / results.length) * 100) : undefined,
    hits: sum('hits'),
    targets,
    misses: sum('missed'),
    false_alarms: sum('extra'),
  })

  return {
    score: targets ? Math.round(Math.max(0, (sum('hits') - sum('extra')) / targets) * 100) : 0,
    entries: [
      { label: 'Візерунків без помилки', value: `${correct} / ${results.length}` },
      { label: 'Клітинок на місці', value: `${sum('hits')} / ${targets}` },
      { label: 'Зайвих клітинок', value: String(sum('extra')) },
    ],
    metrics,
  }
}
