import { pickRandom } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Сортування карток (DCCS — Dimensional Change Card Sort).
 *
 * Міряє перемикання: уміння покинути правило, яке щойно працювало. Кожна
 * картка навмисно збігається з одним кошиком за кольором, а з другим — за
 * формою. Тому будь-яка помилка — це відповідь за іншим правилом, а помилка
 * одразу після зміни — «застрягання» на старому, головний показник гнучкості.
 */
export const TARGETS = [
  { id: 'a', shape: 'star', color: '#c0392b', name: 'червона зірка' },
  { id: 'b', shape: 'triangle', color: '#2d6bd6', name: 'синій трикутник' },
]

/* Картки — «перехрещені» кошики: форма одного, колір іншого. */
export const CARDS = [
  { id: 'star-blue', shape: 'star', color: TARGETS[1].color, name: 'синя зірка' },
  { id: 'triangle-red', shape: 'triangle', color: TARGETS[0].color, name: 'червоний трикутник' },
]

export const RULE_LABELS = { color: 'За кольором', shape: 'За формою' }

export const config = {
  ...gameInfo('card-sort'),
  instructions: [
    'Внизу — два кошики: червона зірка і синій трикутник.',
    'Клади картку в той кошик, що збігається з нею за правилом зверху: за кольором або за формою.',
    'Правило зміниться посеред гри — слідкуй за ним. На складному рівні картка з рамкою сортується за формою.',
  ],
  keyHint: { keys: '1 / 2', text: 'лівий / правий кошик' },
  practice: {
    hint: (level) =>
      level.mode === 'border'
        ? 'Картка в рамці — клади за формою. Без рамки — за кольором.'
        : level.mode === 'hidden'
          ? 'Правило ніхто не скаже. Пробуй: якщо «неправильно» — спробуй сортувати інакше.'
          : 'Дивись на правило зверху. «За кольором» — синю картку в синій кошик. «За формою» — зірку до зірки.',
    level: (level) =>
      level.mode === 'border'
        ? { ...level, trialCount: 4 }
        : level.mode === 'hidden'
          ? { ...level, trialCount: 6, streak: 2 }
          : // Чотири картки, правило міняється після двох: інакше проба не
            // показала б саме того, заради чого гра існує.
            { ...level, trialCount: 4, blockSize: 2 },
  },
  levels: [
    { id: 'one-switch', label: 'Одна зміна', trialCount: 10, mode: 'blocks', blockSize: 5 },
    { id: 'blocks', label: 'Кілька змін', trialCount: 16, mode: 'blocks', blockSize: 4 },
    { id: 'border', label: 'З рамкою', trialCount: 16, mode: 'border' },
    // Як у Вісконсинському тесті: правило ніхто не називає і не оголошує його
    // зміну. Після п'яти правильних поспіль воно тихо змінюється, і дитина має
    // помітити це сама — лише з того, що «правильно» стало «неправильно».
    { id: 'hidden', label: 'Здогадайся сам', trialCount: 24, mode: 'hidden', streak: 5 },
  ],
}

/**
 * Правило проби з номером `index`. Блоки починаються з кольору. У прихованому
 * режимі правило веде саме поле (воно залежить від відповідей дитини) і
 * передає його сюди як `hiddenRule`.
 */
export function ruleAt(level, index, hasBorder = false, hiddenRule = 'color') {
  if (level.mode === 'hidden') return hiddenRule
  if (level.mode === 'border') return hasBorder ? 'shape' : 'color'
  return Math.floor(index / level.blockSize) % 2 === 0 ? 'color' : 'shape'
}

export function generateTrial(level, index, hiddenRule) {
  const card = pickRandom(CARDS)
  const hasBorder = level.mode === 'border' ? Math.random() < 0.5 : false
  return { card, hasBorder, rule: ruleAt(level, index, hasBorder, hiddenRule) }
}

/** Наступне приховане правило: після `streak` правильних поспіль — інше. */
export function nextHiddenRule(rule, correctStreak, level) {
  if (correctStreak < level.streak) return rule
  return rule === 'color' ? 'shape' : 'color'
}

export function expectedTarget(trial) {
  const key = trial.rule === 'color' ? 'color' : 'shape'
  return TARGETS.find((target) => target[key] === trial.card[key]).id
}

export function checkAnswer(trial, targetId) {
  return { correct: targetId === expectedTarget(trial) }
}

/**
 * Результат проби несе дві позначки: чи змінилося правило відносно попередньої
 * проби (`switched`) і чи вже була бодай одна зміна (`afterSwitch`). З них
 * і рахується все, що відрізняє цю гру від звичайної точності.
 */
export function scoring(results) {
  const switchTrials = results.filter((result) => result.switched)
  const blocks = results.some((result) => 'afterSwitch' in result)

  const metrics = trialMetrics(results, {
    switch_trials: switchTrials.length,
    switch_errors: switchTrials.filter((result) => !result.correct).length,
    // Помилка після першої зміни в блоковій грі — це завжди відповідь за
    // попереднім правилом: кожна картка конфліктує з одним із кошиків.
    perseverations: blocks
      ? results.filter((result) => result.afterSwitch && !result.correct).length
      : undefined,
  })

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Помилок одразу після зміни', value: String(metrics.switch_errors ?? 0) },
    ],
    metrics,
  }
}
