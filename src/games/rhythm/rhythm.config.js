import { randomInt } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { slower } from '../engine/adapt'
import { gameInfo } from '../../data/games'

/**
 * Ритм — слухова увага і слухо-моторна координація.
 *
 * Проба на відтворення ритму (Озерецький, Тукін) — частина нейропсихологічного
 * обстеження: діти з труднощами читання й мовлення часто не утримують саме
 * ритмічний малюнок. Ритм тут складається з коротких і довгих пауз, а
 * оцінюється малюнок, а не темп: дитина може стукати повільніше, головне —
 * щоб довгі паузи лишилися довшими за короткі.
 */
export const SHORT = 1
export const LONG = 2

export const config = {
  ...gameInfo('rhythm'),
  /*
   * Як профіль адаптацій торкається вводу (див. engine/AdaptivePlay). Тут
   * міряється сам момент натискання, тож затримка утримання зіпсувала б
   * вимірювання; а одна кнопка в грі вже є.
   */
  input: { hold: false, scan: 'native' },
  instructions: [
    'Спершу послухай ритм — удари з короткими й довгими паузами.',
    'Коли зʼявиться «Тепер ти!», простукай той самий ритм кнопкою або пробілом.',
    'Темп не важливий — важливо, де пауза коротка, а де довга.',
  ],
  keyHint: { keys: 'Пробіл', text: 'удар' },
  practice: {
    hint: 'Слухай: «та-та — та» — це два швидкі удари і один після паузи. Потім простукай так само.',
  },
  relaxed: {
    note: 'Ритм звучить повільніше.',
    level: (level) => ({ ...level, unitMs: slower(level.unitMs, 1.4) }),
  },
  levels: [
    { id: 'see-hear', label: 'Чути й видно', trialCount: 5, beats: [3, 4], unitMs: 380, visual: true },
    { id: 'hear', label: 'Лише чути', trialCount: 6, beats: [4, 5], unitMs: 340, visual: false },
    { id: 'long', label: 'Довгі ритми', trialCount: 8, beats: [5, 6], unitMs: 320, visual: false },
  ],
}

/**
 * Паузи між ударами в одиницях (1 — коротка, 2 — довга). У ритмі від чотирьох
 * ударів є і та, і та: рівний ряд «та-та-та-та» перевіряє лише лічбу.
 */
export function generateTrial(level) {
  const beats = randomInt(level.beats[0], level.beats[1])
  const gaps = Array.from({ length: beats - 1 }, () => (Math.random() < 0.5 ? SHORT : LONG))
  if (gaps.length >= 3 && new Set(gaps).size === 1) {
    gaps[randomInt(0, gaps.length - 1)] = gaps[0] === SHORT ? LONG : SHORT
  }
  return { gaps }
}

/** Моменти ударів у мілісекундах від першого. */
export function beatTimes(trial, unitMs) {
  const times = [0]
  for (const gap of trial.gaps) times.push(times.at(-1) + gap * unitMs)
  return times
}

/*
 * Межа між короткою і довгою паузою — посередині, у півтори одиниці. Одиниця
 * ж береться з темпу самої дитини, тож повільне, але рівне простукування
 * зараховується.
 */
const LONG_BOUNDARY = 1.5

/**
 * Перевірка простуканого. `taps` — моменти натискань дитини (мс).
 *
 * Відхилення — середня відносна похибка кожної паузи після приведення до
 * темпу дитини: «на скільки відсотків ця пауза довша чи коротша, ніж мала б».
 */
export function checkAnswer(trial, taps) {
  if (taps.length !== trial.gaps.length + 1) {
    return { correct: false, errorPct: undefined }
  }

  const childGaps = taps.slice(1).map((time, index) => time - taps[index])
  const units = trial.gaps.reduce((sum, gap) => sum + gap, 0)
  const childUnit = childGaps.reduce((sum, gap) => sum + gap, 0) / units
  if (!(childUnit > 0)) return { correct: false, errorPct: undefined }

  const relative = childGaps.map((gap) => gap / childUnit)
  const correct = relative.every((value, index) =>
    trial.gaps[index] === LONG ? value >= LONG_BOUNDARY : value < LONG_BOUNDARY,
  )
  const errors = relative.map((value, index) => Math.abs(value - trial.gaps[index]) / trial.gaps[index])
  const errorPct = Math.round((errors.reduce((sum, value) => sum + value, 0) / errors.length) * 100)

  return { correct, errorPct }
}

export function scoring(results) {
  const errors = results.map((result) => result.errorPct).filter(Number.isFinite)
  const metrics = trialMetrics(results, {
    rhythm_error_pct: errors.length
      ? Math.round(errors.reduce((sum, value) => sum + value, 0) / errors.length)
      : undefined,
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Ритмів відтворено', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      {
        label: 'Відхилення пауз',
        value: Number.isFinite(metrics.rhythm_error_pct) ? `${metrics.rhythm_error_pct}%` : '—',
      },
    ],
    metrics,
  }
}
