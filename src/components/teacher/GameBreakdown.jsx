import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import { CATEGORIES } from '../../data/games'
import { metricLabel } from '../../games/engine/metrics'
import { breakdownByGame, studentsWithoutAttempts } from '../../lib/groupBreakdown'
import './GameBreakdown.css'

/**
 * Показники, які виносяться в самі рядки таблиці.
 *
 * Решта показників гри — а їх буває з десяток — з'являються, коли рядок
 * розкрити. Винести всі одразу означало б таблицю на п'ятнадцять колонок, у
 * якій головного не знайти.
 */
const HEADLINE = ['accuracy_pct', 'avg_rt_ms']

/**
 * Службові показники, які вчителю показувати нема сенсу.
 *
 * `rt_count` існує тільки для того, щоб середній час зважувався чесно, — це
 * бухгалтерія розрахунку, а не результат дитини. У CSV він лишається: там
 * важливо бачити, на скількох вимірах трималося середнє.
 */
const INTERNAL = new Set(['rt_count'])

/** Підпис без одиниці: значення поруч уже її несе, і «Точність, %: 70%» —
 *  це та сама одиниця двічі. */
function shortLabel(key) {
  return metricLabel(key).split(',')[0]
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

function formatMetric(key, value) {
  if (value === undefined) return '—'
  if (key === 'accuracy_pct' || key.endsWith('_pct')) return `${value}%`
  if (key.endsWith('_ms')) return `${value} мс`
  return String(value)
}

function GameBreakdown({ results, students }) {
  const [openGame, setOpenGame] = useState(null)
  const rows = breakdownByGame(results, students)

  if (rows.length === 0) {
    return (
      <p className="breakdown__empty">
        Щойно діти зіграють, тут з’явиться зріз за іграми: у якій грі клас
        просідає і хто саме потребує допомоги.
      </p>
    )
  }

  return (
    <section className="breakdown">
      <h2>Зріз за іграми</h2>
      <p className="breakdown__lead">
        Натисни гру, щоб побачити кожного учня окремо. Найслабший результат —
        угорі списку.
      </p>

      <table className="breakdown__table">
        <thead>
          <tr>
            <th scope="col">Гра</th>
            <th scope="col">Грали</th>
            <th scope="col">Спроб</th>
            <th scope="col">Бал</th>
            {HEADLINE.map((key) => (
              <th key={key} scope="col">
                {metricLabel(key)}
              </th>
            ))}
            <th scope="col">Востаннє</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOpen = openGame === row.gameId
            const missing = studentsWithoutAttempts(row, students)
            const extraKeys = row.metricKeys.filter(
              (key) => !HEADLINE.includes(key) && !INTERNAL.has(key),
            )

            return (
              <Fragment key={row.gameId}>
                <tr className={isOpen ? 'breakdown__row is-open' : 'breakdown__row'}>
                  <td data-label="Гра">
                    <button
                      type="button"
                      className="breakdown__toggle"
                      onClick={() => setOpenGame(isOpen ? null : row.gameId)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronDown size={16} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" />
                      )}
                      <span className="breakdown__game-title">{row.title}</span>
                      {row.category && CATEGORIES[row.category] && (
                        <Badge tone={CATEGORIES[row.category].color}>
                          {CATEGORIES[row.category].label}
                        </Badge>
                      )}
                    </button>
                  </td>
                  <td data-label="Грали">
                    {row.players} з {students.length}
                  </td>
                  <td data-label="Спроб">{row.attempts}</td>
                  <td data-label="Бал">{row.avgScore ?? '—'}</td>
                  {HEADLINE.map((key) => (
                    <td key={key} data-label={metricLabel(key)}>
                      {formatMetric(key, row.metrics[key])}
                    </td>
                  ))}
                  <td data-label="Востаннє">{formatDate(row.lastPlayed)}</td>
                </tr>

                {isOpen && (
                  <tr className="breakdown__details-row">
                    <td colSpan={5 + HEADLINE.length}>
                      <div className="breakdown__details">
                        {extraKeys.length > 0 && (
                          <dl className="breakdown__extra">
                            {extraKeys.map((key) => (
                              <div key={key} className="breakdown__extra-item">
                                <dt>{shortLabel(key)}</dt>
                                <dd>{formatMetric(key, row.metrics[key])}</dd>
                              </div>
                            ))}
                          </dl>
                        )}

                        <ul className="breakdown__students">
                          {row.students.map((student) => (
                            <li key={student.id} className="breakdown__student">
                              <span className="breakdown__student-name">{student.displayName}</span>
                              <span className="breakdown__student-score">{student.avgScore} балів</span>
                              <span className="breakdown__student-meta">
                                {student.attempts} спроб
                                {HEADLINE.filter((key) => student.metrics[key] !== undefined).map(
                                  (key) => ` · ${shortLabel(key)} ${formatMetric(key, student.metrics[key])}`,
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {/* «Не грав» і «зіграв погано» — різні речі, і плутати
                            їх не можна: порожнє місце теж відповідь. */}
                        {missing.length > 0 && (
                          <p className="breakdown__missing">
                            Ще не грали: {missing.map((student) => student.displayName).join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export default GameBreakdown
