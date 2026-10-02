import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { slower } from '../engine/adapt'
import { gameInfo } from '../../data/games'

/**
 * Слухай і лови — слухова увага: натиснути лише на потрібне слово.
 *
 * Та сама будова, що й Go/No-Go, але стимул звучить, а не показується. Три
 * рівні — три різні вимоги до слуху: смислова категорія (тварина чи ні),
 * перший звук («м» серед «н», «б», «п») і фонематичні пари, де слова
 * відрізняються одним звуком: «коза» проти «коса».
 *
 * Слова промовляє український голос пристрою. Якщо його немає, слово
 * показується текстом — тоді це вже зорова проба, і гра чесно про це каже.
 */
export const LISTS = {
  animals: {
    prompt: 'Натискай, коли почуєш тварину',
    targets: ['кіт', 'собака', 'корова', 'заєць', 'вовк', 'лисиця', 'кінь', 'ведмідь', 'їжак', 'білка', 'коза', 'півень'],
    others: ['стіл', 'машина', 'ложка', 'вікно', 'олівець', 'хмара', 'чашка', 'двері', 'книжка', 'яблуко', 'шапка', 'м’яч'],
  },
  sound: {
    prompt: 'Натискай, коли слово починається зі звуку «м»',
    targets: ['мама', 'мак', 'море', 'миша', 'мило', 'молоко', 'метелик', 'місяць', 'малина', 'музика'],
    others: ['ніс', 'нора', 'банан', 'пила', 'лимон', 'вата', 'носоріг', 'небо', 'папуга', 'рука'],
  },
  pairs: {
    prompt: 'Натискай лише на слово «коза»',
    targets: ['коза'],
    others: ['коса', 'кора', 'роза', 'гроза', 'роса', 'козак'],
  },
}

export const config = {
  ...gameInfo('listen-catch'),
  instructions: [
    'Слова звучатимуть по одному. Уважно слухай.',
    'Натискай кнопку (або пробіл) лише на потрібне слово — яке саме, скаже завдання.',
    'На інші слова не натискай нічого, просто чекай наступного.',
  ],
  keyHint: { keys: 'Пробіл', text: 'це воно!' },
  practice: {
    hint: (level) => `${LISTS[level.list].prompt}. На інші слова — нічого не тисни.`,
  },
  relaxed: {
    note: 'Після кожного слова більше часу на відповідь.',
    level: (level) => ({ ...level, windowMs: slower(level.windowMs, 2) }),
  },
  levels: [
    { id: 'animals', label: 'Тварини', trialCount: 14, list: 'animals', windowMs: 1800 },
    { id: 'sound', label: 'Звук «м»', trialCount: 16, list: 'sound', windowMs: 1600 },
    { id: 'pairs', label: 'Коза чи коса', trialCount: 16, list: 'pairs', windowMs: 1500 },
  ],
}

/*
 * Потрібне слово — у третині проб: досить часто, щоб було на що натискати, і
 * досить рідко, щоб натискати на все підряд було невигідно.
 */
const TARGET_SHARE = 0.35

export function generateSequence(level) {
  const list = LISTS[level.list]
  const others = shuffle(list.others)
  return Array.from({ length: level.trialCount }, (_, index) => {
    const isTarget = Math.random() < TARGET_SHARE
    const word = isTarget ? pickRandom(list.targets) : others[index % others.length]
    return { word, isTarget }
  })
}

export function checkAnswer(trial, pressed) {
  if (trial.isTarget) return { correct: pressed, outcome: pressed ? 'hit' : 'miss' }
  return { correct: !pressed, outcome: pressed ? 'false-alarm' : 'correct-reject' }
}

export function scoring(results) {
  const count = (outcome) => results.filter((r) => r.outcome === outcome).length
  const hits = count('hit')
  const misses = count('miss')
  const falseAlarms = count('false-alarm')
  const correctRejections = count('correct-reject')

  const metrics = trialMetrics(results, {
    hits,
    misses,
    false_alarms: falseAlarms,
    correct_rejections: correctRejections,
    go_trials: hits + misses,
    nogo_trials: falseAlarms + correctRejections,
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Впіймано', value: `${hits} / ${hits + misses}` },
      { label: 'Хибні натискання', value: String(falseAlarms) },
    ],
    metrics,
  }
}
