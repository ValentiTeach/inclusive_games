import { shuffle } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { WORDS } from '../first-sound/firstSound.config'
import { gameInfo } from '../../data/games'

/**
 * Десять слів (за Лурія) — слухо-мовленнєва пам'ять і крива заучування.
 *
 * Той самий набір слів показується кілька разів поспіль, і після кожного
 * разу дитина відшукує, що запам'ятала. Діагностичне значення має не стільки
 * останнє число, скільки форма кривої: росте вона, стоїть на місці чи падає
 * (втома).
 *
 * Класичний варіант — вільне відтворення вголос. Тут — упізнавання серед
 * стількох самих зайвих слів-картинок: дитина, яка не читає й не пише,
 * однаково може відповісти. Якщо на пристрої є голос, слова ще й звучать.
 */
export const config = {
  ...gameInfo('ten-words'),
  instructions: [
    'Слова-картинки зʼявлятимуться по одному. Запамʼятай їх.',
    'Потім знайди серед інших усі, що були, і натисни «Готово».',
    'Ті самі слова покажуть ще кілька разів — щоразу намагайся знайти більше.',
  ],
  keyHint: { keys: 'Цифри та Enter', text: 'позначити / готово' },
  practice: {
    hint: 'Дивись на кожне слово і повторюй його про себе. Потім знайди всі, що бачив.',
    level: (level) => ({ ...level, words: 3, rounds: 1 }),
  },
  levels: [
    { id: 'six', label: '6 слів', words: 6, rounds: 3, showMs: 1600 },
    { id: 'eight', label: '8 слів', words: 8, rounds: 4, showMs: 1500 },
    { id: 'ten', label: '10 слів', words: 10, rounds: 5, showMs: 1400 },
  ],
}

/** Слова до запам'ятовування і стільки ж зайвих — на всю гру. */
export function generateSet(level) {
  const pool = shuffle(WORDS)
  return {
    targets: pool.slice(0, level.words),
    decoys: pool.slice(level.words, level.words * 2),
  }
}

export function checkRound(set, picked) {
  const targets = new Set(set.targets.map((item) => item.word))
  const hits = [...picked].filter((word) => targets.has(word)).length
  return { hits, falseAlarms: picked.size - hits }
}

/** `rounds` — [{ hits, falseAlarms }] по одному на кожен показ. */
export function scoring(rounds, wordCount) {
  const hits = rounds.map((round) => round.hits)
  const total = wordCount * rounds.length
  const correct = hits.reduce((sum, value) => sum + value, 0)
  const last = rounds.at(-1) ?? { hits: 0, falseAlarms: 0 }

  const metrics = defineMetrics({
    total,
    correct,
    errors: total - correct,
    accuracy_pct: total ? Math.round((correct / total) * 100) : undefined,
    false_alarms: rounds.reduce((sum, round) => sum + round.falseAlarms, 0),
    rounds_completed: rounds.length,
    set_size: wordCount,
    first_recall: hits[0],
    best_recall: hits.length ? Math.max(...hits) : undefined,
  })

  return {
    // Бал — за останню спробу: заучування — це те, до чого дитина дійшла, а
    // не середнє з першої, коли вона ще нічого не знала. Зайві слова знімають бал.
    score: wordCount ? clampScore(((last.hits - last.falseAlarms) / wordCount) * 100) : 0,
    entries: [
      { label: 'Крива запамʼятовування', value: hits.join(' → ') },
      { label: 'Найкраща спроба', value: `${metrics.best_recall ?? 0} з ${wordCount}` },
      { label: 'Зайвих слів позначено', value: String(metrics.false_alarms) },
    ],
    metrics,
  }
}
