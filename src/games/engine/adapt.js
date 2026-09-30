/**
 * Як рівень гри змінюється для пробної гри і для темпу «без поспіху».
 *
 * Обидва — перетворення рівня, а не окремий режим усередині кожної гри: ігрове
 * поле й далі отримує просто `level` і не знає, чи це пробна гра. Тож поле, яке
 * вміє грати рівень, уміє грати і його скорочену чи повільнішу версію.
 */

/*
 * Проб у пробній грі. Трьох вистачає, щоб зрозуміти правило і побачити, що
 * буває за правильну й хибну відповідь; більше — це вже гра, яка не рахується,
 * і дитина втомиться раніше, ніж почнеться справжня.
 */
const PRACTICE_TRIALS = 3

/**
 * Скорочений рівень для пробної гри.
 *
 * Більшість ігор складаються з проб (`trialCount`) або раундів (`rounds`), і їх
 * достатньо просто зменшити. Ігри, де довжину задає щось інше (розмір таблиці,
 * кількість пар, довжина послідовності), описують свою пробну версію самі —
 * у `config.practice.level`.
 */
export function practiceLevel(config, level) {
  const custom = config.practice?.level
  if (custom) return { ...custom(level), practice: true }

  const next = { ...level, practice: true }
  if (Number.isFinite(level.trialCount)) next.trialCount = Math.min(level.trialCount, PRACTICE_TRIALS)
  if (Number.isFinite(level.rounds)) next.rounds = Math.min(level.rounds, PRACTICE_TRIALS)
  return next
}

/**
 * Правило гри одним-двома реченнями — те, що показується і звучить під час
 * пробної гри. Для частини ігор воно залежить від рівня (N у N-back, напрям у
 * «Послідовності цифр»), тож може бути функцією від рівня.
 */
export function practiceHint(config, level) {
  const hint = config.practice?.hint
  if (typeof hint === 'function') return hint(level)
  return hint ?? config.instructions?.[1] ?? ''
}

/**
 * Чи змінює «без поспіху» цю гру взагалі.
 *
 * У половині ігор часу на відповідь і так не обмежено, і позначати їхні спроби
 * як «зіграні без поспіху» було б неправдою: зіграно рівно так само.
 */
export function paceChangesGame(config) {
  return Boolean(config.relaxed?.level || config.relaxed?.rescore)
}

export function isRelaxed(config, pace) {
  return pace === 'relaxed' && paceChangesGame(config)
}

/** Рівень з урахуванням темпу. Поле дізнається про темп з `level.relaxed`. */
export function paceLevel(config, level, pace) {
  if (!isRelaxed(config, pace)) return level
  const change = config.relaxed.level ?? ((same) => same)
  return { ...change(level), relaxed: true }
}

const NO_TIME_LIMIT = 'У цій грі немає обмеження часу — відповідай, коли будеш готовий.'

/** Що саме «без поспіху» змінює в цій грі — щоб дорослий знав, на що погоджується. */
export function paceNote(config) {
  return config.relaxed?.note ?? NO_TIME_LIMIT
}

/**
 * Результат спроби, зіграної без поспіху.
 *
 * Бал перераховується там, де гра карала за час (Шульте, Світлофор), і спроба
 * позначається і для вчителя (рядок «Темп»), і для бази (`relaxed_pace`):
 * «80 без поспіху» і «80 на звичайному темпі» — різні результати, і в звіті
 * вони не мають зливатися.
 */
export function paceResult(config, result, pace) {
  if (!isRelaxed(config, pace)) return result

  const rescored = config.relaxed.rescore ? config.relaxed.rescore(result) : result
  return {
    ...rescored,
    entries: [...rescored.entries, { label: 'Темп', value: 'Без поспіху' }],
    metrics: { ...rescored.metrics, relaxed_pace: true },
  }
}

/**
 * Скільки разів довше. Округлення до десятка мілісекунд — щоб у налагодженні
 * бачити 2500, а не 2499.9999.
 */
export function slower(ms, factor) {
  return Math.round((ms * factor) / 10) * 10
}
