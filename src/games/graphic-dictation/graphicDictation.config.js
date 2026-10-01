import { pickRandom } from '../engine/random'
import { defineMetrics } from '../engine/metrics'
import { clampScore } from '../engine/score'
import { gameInfo } from '../../data/games'

/**
 * Графічний диктант — просторова орієнтація на площині: «2 вправо, 1 вгору».
 *
 * Класика підготовки до школи й корекційних занять. Тут лінія ведеться не
 * олівцем, а стрілками, по одній клітинці за натискання: так видно кожну
 * помилку напрямку окремо — саме те, що цікавить фахівця (ліво/право,
 * верх/низ), а не те, наскільки рівно дитина тримає олівець.
 *
 * Три способи давати команду — три різні навички: стрілка (зорове
 * співставлення), слово «вправо» (мовлення про простір) і зразок без команд
 * (самостійно розкласти малюнок на кроки).
 */
export const DIRECTIONS = {
  up: { word: 'вгору', arrow: '↑', dx: 0, dy: -1 },
  down: { word: 'вниз', arrow: '↓', dx: 0, dy: 1 },
  left: { word: 'вліво', arrow: '←', dx: -1, dy: 0 },
  right: { word: 'вправо', arrow: '→', dx: 1, dy: 0 },
}

const c = (dir, n) => ({ dir, n })

/*
 * Мотиви повторюються, як у справжньому диктанті: дитина, що зрозуміла
 * візерунок, на другому повторі передбачає крок. Кожен мотив повертається на
 * ту саму висоту і не перетинає сам себе.
 */
export const MOTIFS = {
  teeth: [c('up', 2), c('right', 1), c('down', 2), c('right', 1)],
  stairs: [c('up', 1), c('right', 1), c('up', 1), c('right', 1), c('down', 2), c('right', 1)],
  castle: [
    c('up', 1),
    c('right', 1),
    c('up', 1),
    c('right', 1),
    c('down', 1),
    c('right', 1),
    c('down', 1),
    c('right', 1),
  ],
  meander: [c('up', 2), c('right', 2), c('down', 1), c('left', 1), c('down', 1), c('right', 2)],
  hook: [c('right', 1), c('up', 2), c('right', 2), c('down', 1), c('left', 1), c('down', 1), c('right', 1)],
}

export const config = {
  ...gameInfo('graphic-dictation'),
  instructions: [
    'Зелена точка — початок. Кожне натискання стрілки веде лінію на одну клітинку.',
    'Виконуй команди по черзі: «2 вправо» — це два натискання стрілки вправо.',
    'На складному рівні команд немає — повтори візерунок зі зразка.',
  ],
  keyHint: { keys: '← ↑ ↓ →', text: 'вести лінію' },
  practice: {
    hint: (level) =>
      level.mode === 'copy'
        ? 'Подивись на зразок і веди лінію так само: від зеленої точки, клітинка за клітинкою.'
        : 'Читай команду і натискай стрілку стільки разів, скільки сказано. «2 вправо» — двічі →.',
    level: (level) => ({ ...level, trialCount: 1, repeats: 1 }),
  },
  levels: [
    { id: 'arrows', label: 'Стрілками', trialCount: 2, repeats: 2, mode: 'arrows', motifs: ['teeth', 'stairs', 'castle'] },
    {
      id: 'words',
      label: 'Словами',
      trialCount: 3,
      repeats: 2,
      mode: 'words',
      motifs: ['teeth', 'stairs', 'castle', 'meander', 'hook'],
    },
    { id: 'copy', label: 'Зі зразка', trialCount: 3, repeats: 2, mode: 'copy', motifs: ['meander', 'hook', 'castle', 'stairs'] },
  ],
}

/** Команди візерунка: мотив кілька разів, сусідні однакові напрямки злиті. */
export function buildCommands(motif, repeats) {
  const merged = []
  for (let i = 0; i < repeats; i++) {
    for (const command of motif) {
      const last = merged.at(-1)
      if (last && last.dir === command.dir) last.n += command.n
      else merged.push({ ...command })
    }
  }
  return merged
}

export function flattenSteps(commands) {
  return commands.flatMap((command) => Array(command.n).fill(command.dir))
}

/** Точки лінії від старту (у клітинках), і розмір сітки з полем в одну клітинку. */
export function layout(steps) {
  let x = 0
  let y = 0
  const raw = [{ x, y }]
  for (const dir of steps) {
    x += DIRECTIONS[dir].dx
    y += DIRECTIONS[dir].dy
    raw.push({ x, y })
  }
  const minX = Math.min(...raw.map((p) => p.x))
  const minY = Math.min(...raw.map((p) => p.y))
  const maxX = Math.max(...raw.map((p) => p.x))
  const maxY = Math.max(...raw.map((p) => p.y))
  const points = raw.map((p) => ({ x: p.x - minX + 1, y: p.y - minY + 1 }))
  return { points, cols: maxX - minX + 2, rows: maxY - minY + 2 }
}

export function generateTrial(level, previous) {
  const options = level.motifs.filter((name) => name !== previous?.motif)
  const motif = pickRandom(options.length ? options : level.motifs)
  const commands = buildCommands(MOTIFS[motif], level.repeats)
  const steps = flattenSteps(commands)
  return { motif, commands, steps, ...layout(steps) }
}

/** Яку команду зараз виконує дитина і скільки кроків у ній уже зроблено. */
export function commandAt(commands, stepIndex) {
  let passed = 0
  for (let index = 0; index < commands.length; index++) {
    if (stepIndex < passed + commands[index].n) return { index, done: stepIndex - passed }
    passed += commands[index].n
  }
  return { index: commands.length, done: 0 }
}

export function commandWords(command) {
  return `${command.n} ${DIRECTIONS[command.dir].word}`
}

export function checkAnswer(trial, stepIndex, dir) {
  return { correct: trial.steps[stepIndex] === dir }
}

export function scoring({ steps, errors, elapsedMs }) {
  const total = steps + errors
  const metrics = defineMetrics({
    total,
    correct: steps,
    errors,
    accuracy_pct: total ? Math.round((steps / total) * 100) : undefined,
    duration_ms: Math.round(elapsedMs),
  })

  return {
    score: clampScore(metrics.accuracy_pct ?? 0),
    entries: [
      { label: 'Кроків', value: String(steps) },
      { label: 'Помилок напрямку', value: String(errors) },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
    ],
    metrics,
  }
}
