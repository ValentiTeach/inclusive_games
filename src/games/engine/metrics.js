/**
 * Сирі числа однієї спроби — те, що лягає в results.metrics.
 *
 * `entries` писався для екрана результатів: кожне значення там уже готова
 * фраза («85%», «450 мс»). Через це в базі не було чого агрегувати, крім
 * `score`. Тут ті самі вимірювання числами.
 *
 * Дві домовленості, обидві навмисні:
 *
 * - Ключі в snake_case, на відміну від решти JS тут. Сенс колонки в тому, що
 *   хтось напише `metrics->>'avg_rt_ms'` у SQL, а camelCase у jsonb означав би
 *   лапки навколо кожного ключа назавжди.
 * - Одиниця стоїть у назві ключа (`_pct`, `_ms`). `accuracy_pct` — це 0–100,
 *   та сама шкала, що й `score`, і те саме число, яке бачила дитина. Голе
 *   `accuracy` поруч із `score` в одному рядку таблиці — це той випадок, коли
 *   середнє тихо виходить у сто разів меншим.
 *
 * Ключ, якого гра не міряє, **відсутній**, а не null: відсутність читається як
 * «ця гра цього не вимірює», і `avg()` пропускає такі рядки сам.
 */

function mean(numbers) {
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

/**
 * Збирає об'єкт показників, викидаючи все, що гра не поміряла. Приймає числа
 * й булеві значення; `undefined`, `null` і NaN не доходять до бази.
 */
export function defineMetrics(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => Number.isFinite(value) || typeof value === 'boolean',
    ),
  )
}

/**
 * Форма, спільна для ігор, побудованих на пробах: скільки, скільки правильно,
 * як швидко.
 *
 * Час рахується окремо від проб, а не за `total`. У Go/No-Go правильна
 * відповідь — це часто саме *не натиснути*, і часу для такої проби не існує;
 * `rt_count` каже, на скількох пробах середнє насправді зважене.
 */
export function trialMetrics(results, extra = {}) {
  const total = results.length
  const correct = results.filter((result) => result.correct).length
  const times = results
    .map((result) => result.reactionTimeMs)
    .filter((value) => Number.isFinite(value))

  return defineMetrics({
    total,
    correct,
    errors: total - correct,
    accuracy_pct: total ? Math.round((correct / total) * 100) : undefined,
    rt_count: times.length ? times.length : undefined,
    avg_rt_ms: times.length ? mean(times) : undefined,
    best_rt_ms: times.length ? Math.min(...times) : undefined,
    ...extra,
  })
}

/** Показники для ігор, які міряють лише час (Час реакції). */
export function timingMetrics(reactionTimes) {
  const times = reactionTimes.filter((value) => Number.isFinite(value))

  return defineMetrics({
    total: reactionTimes.length,
    rt_count: times.length ? times.length : undefined,
    avg_rt_ms: times.length ? mean(times) : undefined,
    best_rt_ms: times.length ? Math.min(...times) : undefined,
    worst_rt_ms: times.length ? Math.max(...times) : undefined,
  })
}

/**
 * Підписи колонок для експорту.
 *
 * Живуть поруч із визначеннями ключів, а не в csv.js: інакше додана метрика
 * мовчки поїхала б у файл під сирим ключем, і ніхто б не помітив. Порядок цього
 * об'єкта — порядок колонок; спільні показники йдуть перед специфічними для
 * окремих ігор.
 */
export const METRIC_LABELS = {
  accuracy_pct: 'Точність, %',
  correct: 'Правильних',
  total: 'Проб',
  errors: 'Помилок',
  avg_rt_ms: 'Сер. час, мс',
  best_rt_ms: 'Найкращий час, мс',
  worst_rt_ms: 'Найгірший час, мс',
  rt_count: 'Проб із часом',
  duration_ms: 'Тривалість, мс',
  cpm: 'Символів за хвилину',
  chars: 'Символів',
  hits: 'Влучань',
  early_presses: 'Натиснув зарано',
  avg_offset_pct: 'Сер. відхилення, % смуги',
  best_offset_pct: 'Найточніше, % смуги',
  targets: 'Цілей',
  misses: 'Пропущено сигналів',
  false_alarms: 'Хибних натискань',
  correct_rejections: 'Правильних утримань',
  go_trials: 'Проб «тисни»',
  nogo_trials: 'Проб «не тисни»',
  moves: 'Ходів',
  pairs: 'Пар',
  extra_moves: 'Зайвих ходів',
  grid_size: 'Розмір таблиці',
  rounds_completed: 'Пройдено раундів',
  span: 'Обсяг пам’яті, цифр',
  set_size: 'Предметів у наборі',
  target_length: 'Ціль рівня',
  reached_target: 'Ціль досягнута',
}

/**
 * Як показник зводиться докупи з кількох спроб.
 *
 * Живе поруч із підписами й з тієї самої причини: доданий показник, для якого
 * ніхто не сказав, що з ним робити, мовчки усереднився б — і в зрізі групи
 * зʼявилося б число, яке нічого не означає.
 *
 * Чотири способи, і кожен обраний за змістом самого показника:
 *
 * - `mean` — середнє, зважене за кількістю проб (див. aggregateMetric). Просте
 *   середнє від середніх бреше, щойно спроби різної довжини: гра з трьох проб
 *   важила б стільки ж, скільки гра з двадцяти.
 * - `sum` — лічильники: скільки всього проб, помилок, влучань.
 * - `min` — найкраще з можливих, коли менше означає краще: найшвидша реакція,
 *   найточніше влучання.
 * - `max` — досягнута стеля: обсяг пам'яті, розмір таблиці, пройдений раунд.
 *
 * Показник, якого тут немає, у зріз не потрапляє взагалі — краще не показати,
 * ніж показати неправду.
 */
export const METRIC_AGGREGATION = {
  accuracy_pct: 'mean',
  correct: 'sum',
  total: 'sum',
  errors: 'sum',
  avg_rt_ms: 'mean',
  best_rt_ms: 'min',
  worst_rt_ms: 'max',
  rt_count: 'sum',
  duration_ms: 'mean',
  cpm: 'mean',
  chars: 'sum',
  hits: 'sum',
  targets: 'sum',
  misses: 'sum',
  false_alarms: 'sum',
  correct_rejections: 'sum',
  go_trials: 'sum',
  nogo_trials: 'sum',
  moves: 'sum',
  pairs: 'sum',
  extra_moves: 'sum',
  grid_size: 'max',
  rounds_completed: 'max',
  span: 'max',
  set_size: 'max',
  early_presses: 'sum',
  avg_offset_pct: 'mean',
  best_offset_pct: 'min',
  target_length: 'max',
}

/**
 * Вага спроби при усередненні.
 *
 * Точність — це частка від `total` проб, середній час — середнє по `rt_count`
 * вимірах. Зважувати треба саме цим: без ваги спроба з трьох проб тягнула б
 * середнє класу так само сильно, як спроба з двадцяти.
 */
export function metricWeight(key, metrics) {
  if (key === 'avg_rt_ms') return metrics.rt_count ?? 1
  if (key === 'accuracy_pct') return metrics.total ?? 1
  return 1
}

/**
 * Зводить один показник із кількох спроб. Спроби, де показника немає,
 * пропускаються: відсутність означає «ця гра цього не міряє», а не нуль.
 */
export function aggregateMetric(key, attempts) {
  const kind = METRIC_AGGREGATION[key]
  if (!kind) return undefined

  const values = []
  const weights = []
  for (const metrics of attempts) {
    const value = metrics?.[key]
    if (!Number.isFinite(value)) continue
    values.push(value)
    weights.push(metricWeight(key, metrics))
  }

  if (values.length === 0) return undefined
  if (kind === 'min') return Math.min(...values)
  if (kind === 'max') return Math.max(...values)
  if (kind === 'sum') return values.reduce((sum, value) => sum + value, 0)

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight === 0) return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  const weighted = values.reduce((sum, value, index) => sum + value * weights[index], 0)
  return Math.round(weighted / totalWeight)
}

/**
 * Ключі в порядку METRIC_LABELS, а невідомі — за абеткою в кінці. Невідомий
 * ключ потрапляє в експорт під власним іменем: краще сира назва колонки, ніж
 * тихо загублене вимірювання.
 */
export function orderMetricKeys(keys) {
  const known = Object.keys(METRIC_LABELS).filter((key) => keys.includes(key))
  const unknown = keys.filter((key) => !(key in METRIC_LABELS)).sort()
  return [...known, ...unknown]
}

export function metricLabel(key) {
  return METRIC_LABELS[key] ?? key
}
