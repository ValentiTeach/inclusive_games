/**
 * Порівняння лише з собою.
 *
 * «Новий рекорд!» міряє дитину її ж найкращим днем — і для тривожної дитини
 * кожна гра після рекорду стає програною. Тут інакше: сьогоднішня спроба
 * ставиться поруч зі спробою тиждень тому (чи з минулою, якщо тижневої ще
 * немає), і говориться лише про те, що вийшло краще або так само. Гірший день
 * не коментується зовсім: дитина й так це знає, а екран результатів — не
 * місце для докору.
 *
 * Порівнюються лише порівнянні спроби: той самий рівень, той самий темп і та
 * сама довжина. «20 з 20» проти «5 з 5» — це не прогрес і не регрес.
 */

const WEEK_MS = 6 * 24 * 60 * 60 * 1000

export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/*
 * Що саме порівнювати — перше, що є в обох спробах. Лічильник правильних
 * відповідей зрозумілий дитині найкраще («на 2 більше»), час — другий,
 * бал — останній запасний варіант.
 */
const MEASURES = [
  {
    key: 'correct',
    phrase: (d) => `на ${d} ${plural(d, 'правильну відповідь', 'правильні відповіді', 'правильних відповідей')} більше`,
  },
  {
    key: 'span',
    phrase: (d) => `на ${d} ${plural(d, 'цифру', 'цифри', 'цифр')} довше в пам'яті`,
  },
  {
    key: 'rounds_completed',
    phrase: (d) => `на ${d} ${plural(d, 'раунд', 'раунди', 'раундів')} далі`,
  },
  {
    key: 'duration_ms',
    lowerIsBetter: true,
    minDelta: 1000,
    phrase: (d) => `на ${Math.round(d / 1000)} с швидше`,
  },
  {
    key: 'score',
    fromAttempt: true,
    phrase: (d) => `на ${d} ${plural(d, 'бал', 'бали', 'балів')} більше`,
  },
]

function valueOf(attempt, measure) {
  const value = measure.fromAttempt ? attempt.score : attempt.metrics?.[measure.key]
  return Number.isFinite(value) ? value : null
}

function comparable(a, b) {
  return (
    a.levelId === b.levelId &&
    Boolean(a.metrics?.relaxed_pace) === Boolean(b.metrics?.relaxed_pace) &&
    Boolean(a.metrics?.short_attempt) === Boolean(b.metrics?.short_attempt)
  )
}

/**
 * @param previous спроби до цієї, новіші першими ({ score, metrics, levelId, date })
 * @param current  щойно зіграна спроба
 * @returns { text, improved } або null, якщо сказати нічого доброго й чесного
 */
export function compareWithPast(previous, current, now = new Date()) {
  const pool = previous.filter((attempt) => comparable(attempt, current))
  if (pool.length === 0) return null

  const weekAgo = pool.find((attempt) => now - new Date(attempt.date) >= WEEK_MS)
  const reference = weekAgo ?? pool[0]
  const when = weekAgo ? 'ніж минулого тижня' : 'ніж минулого разу'

  const measure = MEASURES.find(
    (item) => valueOf(current, item) !== null && valueOf(reference, item) !== null,
  )
  if (!measure) return null

  const raw = valueOf(current, measure) - valueOf(reference, measure)
  const delta = measure.lowerIsBetter ? -raw : raw
  const minDelta = measure.minDelta ?? 1

  if (delta >= minDelta) {
    return { improved: true, text: `Сьогодні — ${measure.phrase(Math.round(delta))}, ${when}.` }
  }
  if (Math.abs(delta) < minDelta) {
    return { improved: false, text: `Так само, як ${weekAgo ? 'минулого тижня' : 'минулого разу'}, — рівно й стабільно.` }
  }
  return null
}
