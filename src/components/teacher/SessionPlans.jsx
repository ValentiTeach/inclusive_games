import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Plus } from 'lucide-react'
import { archivePlan, listGroupPlans, listRunsForPlans, runReport } from '../../lib/sessions'
import { stepTitle } from '../../data/sessionTemplates'
import '../specialist/Specialist.css'
import './SessionPlans.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

/**
 * Заняття групи: що призначено і звіт по кожному — по заняттю, а не по
 * окремих спробах. Для кожної дитини видно, скільки кроків пройдено, скільки
 * хвилин тривало і як вийшли ігри заняття.
 *
 * Настрій тут не показується: він зашифрований і читається на картці дитини,
 * коли фахівець відімкне щоденник.
 */
function SessionPlans({ groupId, students, results }) {
  const [plans, setPlans] = useState([])
  const [runs, setRuns] = useState([])
  const [available, setAvailable] = useState(true)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const list = await listGroupPlans(groupId)
      if (cancelled) return
      if (list === null) {
        setAvailable(false)
        return
      }
      setPlans(list)
      const runList = await listRunsForPlans(list.map((plan) => plan.id))
      if (!cancelled) setRuns(runList)
    }
    load().catch(() => !cancelled && setError('Не вдалося завантажити заняття.'))
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (!available) return null

  const names = new Map(students.map((student) => [student.id, student.displayName]))
  const visible = plans.filter((plan) => !plan.archived_at)

  async function handleArchive(plan) {
    if (!window.confirm(`Зняти заняття «${plan.title}»? Звіти про проведені заняття лишаться.`)) return
    try {
      await archivePlan(plan.id)
      setPlans((list) =>
        list.map((item) => (item.id === plan.id ? { ...item, archived_at: new Date().toISOString() } : item)),
      )
    } catch {
      setError('Не вдалося зняти заняття.')
    }
  }

  return (
    <section className="session-plans">
      <h2>
        <CalendarCheck size={20} aria-hidden="true" /> Заняття
      </h2>
      <p className="session-plans__lead">
        Послідовність кроків із візуальним розкладом для дитини: привітання, дихання, ігри,
        фізхвилинка, рефлексія. Готові шаблони — «Увага, 1–2 клас», «Підготовка до письма»,
        «Робоча пам’ять», «Саморегуляція».
      </p>
      <Link to={`/groups/${groupId}/sessions/new`} className="specialist-button session-plans__new">
        <Plus size={16} aria-hidden="true" /> Нове заняття
      </Link>

      {error && <p className="specialist-error">{error}</p>}

      {visible.length === 0 ? (
        <p className="session-plans__empty">Поки нічого не призначено.</p>
      ) : (
        <ul className="specialist-list session-plans__list">
          {visible.map((plan) => {
            const planRuns = runs.filter((run) => run.plan_id === plan.id)
            const finished = planRuns.filter((run) => run.finished_at)
            const audience = plan.student_id
              ? (names.get(plan.student_id) ?? 'одна дитина')
              : 'уся група'
            const expanded = open === plan.id
            return (
              <li key={plan.id} className="specialist-list__item">
                <div className="specialist-list__head">
                  <span>
                    {plan.title}
                    {plan.kind === 'battery' && ' · зріз'}
                  </span>
                  <span className="specialist-muted">
                    {audience} · {plan.steps.length} кроків · завершили {finished.length}
                    {plan.student_id ? '' : ` з ${students.length}`}
                  </span>
                </div>
                <p className="specialist-muted">
                  {plan.steps.map(stepTitle).join(' → ')}
                </p>
                <div className="vault__row">
                  <button
                    type="button"
                    className="specialist-button specialist-button--secondary"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : plan.id)}
                  >
                    {expanded ? 'Сховати звіт' : 'Звіт по заняттю'}
                  </button>
                  <button
                    type="button"
                    className="specialist-button specialist-button--secondary"
                    onClick={() => handleArchive(plan)}
                  >
                    Зняти
                  </button>
                </div>

                {expanded && (
                  <div className="specialist-table-wrap session-plans__report">
                    {planRuns.length === 0 ? (
                      <p>Ще ніхто не проходив.</p>
                    ) : (
                      <table className="specialist-table">
                        <thead>
                          <tr>
                            <th>Дитина</th>
                            <th>Дата</th>
                            <th>Кроків</th>
                            <th>Хвилин</th>
                            {plan.steps.map((step, index) =>
                              step.kind === 'game' ? <th key={index}>{stepTitle(step)}</th> : null,
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {planRuns.map((run) => {
                            const report = runReport(
                              plan,
                              run,
                              results.filter((result) => result.user_id === run.student_id),
                            )
                            return (
                              <tr key={run.id}>
                                <td>
                                  <Link to={`/groups/${groupId}/students/${run.student_id}`}>
                                    {names.get(run.student_id) ?? 'Учень'}
                                  </Link>
                                </td>
                                <td>{formatDate(run.started_at)}</td>
                                <td>
                                  {report.done} / {report.total}
                                </td>
                                <td>{report.minutes ?? 'не завершено'}</td>
                                {report.steps.map((item) =>
                                  item.step.kind === 'game' ? (
                                    <td key={item.index}>
                                      {item.attempt
                                        ? item.attempt.score
                                        : item.status === 'skipped'
                                          ? 'пропущено'
                                          : '—'}
                                    </td>
                                  ) : null,
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default SessionPlans
