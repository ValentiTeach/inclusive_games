import { describe, it, expect } from 'vitest'
import { scoring as goNoGo } from './go-no-go/goNoGo.config'
import { scoring as matrices } from './matrices/matrices.config'
import { scoring as memoryPairs } from './memory-pairs/memoryPairs.config'
import { scoring as mentalRotation } from './mental-rotation/mentalRotation.config'
import { scoring as nback } from './n-back/nback.config'
import { scoring as quickMath } from './quick-math/quickMath.config'
import { scoring as reactionTime } from './reaction-time/reactionTime.config'
import { scoring as schulte } from './schulte/schulte.config'
import { scoring as simon } from './simon/simon.config'
import { scoring as stroop } from './stroop/stroop.config'
import { scoring as subitizing } from './subitizing/subitizing.config'
import { scoring as targetSearch } from './target-search/targetSearch.config'
import { scoring as keyboardTrainer } from './keyboard-trainer/keyboardTrainer.config'
import { GAME_REGISTRY } from './registry'

// 3 правильні з 4, часи 400/600/500/300 — точність 75%, середнє 450, найкраще 300.
const TRIALS = [
  { correct: true, reactionTimeMs: 400 },
  { correct: true, reactionTimeMs: 600 },
  { correct: false, reactionTimeMs: 500 },
  { correct: true, reactionTimeMs: 300 },
]

const SCENARIOS = [
  { id: 'stroop', run: () => stroop(TRIALS) },
  { id: 'subitizing', run: () => subitizing(TRIALS) },
  { id: 'target-search', run: () => targetSearch(TRIALS) },
  { id: 'matrices', run: () => matrices(TRIALS) },
  { id: 'mental-rotation', run: () => mentalRotation(TRIALS) },
  { id: 'quick-math', run: () => quickMath(TRIALS) },
  {
    id: 'go-no-go',
    run: () =>
      goNoGo([
        { correct: true, outcome: 'hit', reactionTimeMs: 400 },
        { correct: true, outcome: 'hit', reactionTimeMs: 500 },
        { correct: false, outcome: 'miss' },
        { correct: false, outcome: 'false-alarm', reactionTimeMs: 250 },
        { correct: true, outcome: 'correct-reject' },
      ]),
  },
  {
    id: 'n-back',
    run: () =>
      nback([
        { correct: true, outcome: 'hit', reactionTimeMs: 300 },
        { correct: false, outcome: 'miss' },
        { correct: false, outcome: 'false-alarm', reactionTimeMs: 220 },
        { correct: true, outcome: 'correct-reject' },
      ]),
  },
  { id: 'reaction-time', run: () => reactionTime([320, 410, 280]) },
  { id: 'schulte', run: () => schulte({ elapsedMs: 42_300, mistakes: 2, size: 5 }) },
  {
    id: 'memory-pairs',
    run: () => memoryPairs({ moves: 20, elapsedMs: 61_500, pairs: 8 }),
  },
  { id: 'simon', run: () => simon({ roundsCompleted: 5, targetLength: 8 }) },
  {
    id: 'keyboard-trainer',
    run: () =>
      keyboardTrainer([
        { correct: true, reactionTimeMs: 500 },
        { correct: true, reactionTimeMs: 700 },
        { correct: false, reactionTimeMs: 900 },
        { correct: true, reactionTimeMs: 500 },
      ]),
  },
]

describe('кожна гра пише сирі числа, а не лише рядки', () => {
  it('covers every game in the registry, so a new game cannot slip through', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(Object.keys(GAME_REGISTRY).sort())
  })

  it.each(SCENARIOS)('$id returns metrics next to the display strings', ({ run }) => {
    const { metrics, entries } = run()

    expect(entries.length).toBeGreaterThan(0)
    expect(Object.keys(metrics).length).toBeGreaterThan(0)
  })

  /**
   * Сенс усієї колонки. Якщо сюди просочиться рядок на кшталт '85%' або
   * '450 мс', ми знову отримаємо дані, які не можна ні усереднити, ні
   * порівняти — тобто рівно те, від чого ця зміна й позбавлялася.
   */
  it.each(SCENARIOS)('$id stores numbers, never formatted text', ({ run }) => {
    for (const [key, value] of Object.entries(run().metrics)) {
      expect(
        Number.isFinite(value) || typeof value === 'boolean',
        `${key} має бути числом, а не ${JSON.stringify(value)}`,
      ).toBe(true)
    }
  })

  it.each(SCENARIOS)('$id keeps errors consistent with total and correct', ({ run }) => {
    const { metrics } = run()
    if (!('total' in metrics && 'correct' in metrics)) return

    expect(metrics.errors).toBe(metrics.total - metrics.correct)
  })

  it.each(SCENARIOS)('$id keeps the score inside 0-100', ({ run }) => {
    const { score } = run()

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

/**
 * Екран і база мають казати те саме. Рядки в entries будуються з metrics саме
 * для цього, і ці перевірки тримають зв'язок: якщо колись хтось порахує число
 * для показу окремо, розбіжність спливе тут, а не в звіті вчителя.
 */
describe('рядки на екрані збігаються з числами в базі', () => {
  it.each([
    ['stroop', stroop, 'Середній час реакції'],
    ['subitizing', subitizing, 'Середній час відповіді'],
    ['target-search', targetSearch, 'Середній час пошуку'],
    ['matrices', matrices, 'Середній час'],
    ['mental-rotation', mentalRotation, 'Середній час'],
    ['quick-math', quickMath, 'Середній час на приклад'],
  ])('%s', (_id, score, timeLabel) => {
    const { entries, metrics, score: value } = score(TRIALS)
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics).toMatchObject({
      total: 4,
      correct: 3,
      errors: 1,
      accuracy_pct: 75,
      rt_count: 4,
      avg_rt_ms: 450,
      best_rt_ms: 300,
    })
    expect(byLabel['Правильно']).toBe('3 / 4')
    expect(byLabel['Точність']).toBe('75%')
    expect(byLabel[timeLabel]).toBe('450 мс')
    expect(value).toBe(75)
  })

  it('go-no-go keeps misses and false alarms apart', () => {
    const { entries, metrics } = SCENARIOS.find((s) => s.id === 'go-no-go').run()
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    // Пропустити сигнал і натиснути на заборонений — різні дефіцити, і в базі
    // вони мають лишатися розрізненими, а не злитися в «помилки».
    expect(metrics).toMatchObject({
      total: 5,
      correct: 3,
      accuracy_pct: 60,
      hits: 2,
      misses: 1,
      false_alarms: 1,
      correct_rejections: 1,
      go_trials: 3,
      nogo_trials: 2,
    })
    expect(byLabel['Точність']).toBe('60%')
    expect(byLabel['Хибні натискання']).toBe('1')
    expect(byLabel['Пропущені сигнали']).toBe('1')
  })

  // Час є лише там, де дитина натиснула: правильне утримання і прогавлений
  // сигнал часу не мають, тож середнє зважене на трьох пробах із пʼяти.
  it('go-no-go averages only the trials where a key was pressed', () => {
    const { metrics } = SCENARIOS.find((s) => s.id === 'go-no-go').run()

    expect(metrics.rt_count).toBe(3)
    expect(metrics.avg_rt_ms).toBe(383)
    expect(metrics.best_rt_ms).toBe(250)
  })

  it('n-back records the reaction time it never used to record', () => {
    const { entries, metrics } = SCENARIOS.find((s) => s.id === 'n-back').run()
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics).toMatchObject({
      total: 4,
      hits: 1,
      misses: 1,
      targets: 2,
      false_alarms: 1,
      rt_count: 2,
      avg_rt_ms: 260,
    })
    expect(byLabel['Знайдено збігів']).toBe('1 / 2')
  })

  it('reaction-time reports the same average it prints', () => {
    const { entries, metrics } = reactionTime([320, 410, 280])
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(metrics).toEqual({
      total: 3,
      rt_count: 3,
      avg_rt_ms: 337,
      best_rt_ms: 280,
      worst_rt_ms: 410,
    })
    expect(byLabel['Середній час']).toBe('337 мс')
    expect(byLabel['Найкращий час']).toBe('280 мс')
    expect(byLabel['Раундів зіграно']).toBe('3')
  })

  // На екрані час округлений до десятих секунди — читати зручніше. У базі він
  // у мілісекундах: округлення для читання не має ставати округленням для
  // вимірювання.
  it('schulte keeps full millisecond precision, unlike the screen', () => {
    const { entries, metrics } = schulte({ elapsedMs: 42_345, mistakes: 2, size: 5 })
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    expect(byLabel['Час']).toBe('42.3 с')
    expect(metrics).toEqual({
      duration_ms: 42_345,
      errors: 2,
      grid_size: 5,
      total: 25,
    })
  })

  it('memory-pairs records the moves above the minimum, not just the moves', () => {
    const { entries, metrics } = memoryPairs({ moves: 20, elapsedMs: 61_500, pairs: 8 })
    const byLabel = Object.fromEntries(entries.map((e) => [e.label, e.value]))

    // Самі ходи між рівнями з різною кількістю пар не порівняти — 20 ходів на
    // 6 парах і на 12 різні за змістом. extra_moves порівнюються.
    expect(metrics).toEqual({
      duration_ms: 61_500,
      moves: 20,
      pairs: 8,
      extra_moves: 12,
    })
    expect(byLabel['Ходи']).toBe('20')
  })

  it('simon records whether the level target was reached', () => {
    expect(simon({ roundsCompleted: 5, targetLength: 8 }).metrics).toEqual({
      rounds_completed: 5,
      target_length: 8,
      reached_target: false,
    })
    expect(simon({ roundsCompleted: 8, targetLength: 8 }).metrics.reached_target).toBe(true)
  })
})
