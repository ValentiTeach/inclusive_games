import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookLock, ChartLine, Goal, Settings2, CalendarCheck } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { listStudentAdaptations } from '../lib/adaptations'
import {
  batterySlices,
  createPlan,
  listGroupPlans,
  listRunsForStudent,
  nextBatteryWindow,
  runReport,
} from '../lib/sessions'
import {
  closeGoal,
  createGoal,
  deleteGoal,
  goalMetricLabel,
  goalProgress,
  goalTitle,
  listGoals,
  metricOptions,
} from '../lib/goals'
import {
  BEHAVIORS,
  BEHAVIOR_LABELS,
  HELP_LABELS,
  HELP_LEVELS,
  MOOD_LABELS,
  addDiaryEntry,
  deleteDiaryEntry,
  listDiary,
  moodContext,
  openDiary,
} from '../lib/diary'
import { readSealed, useVaultState } from '../lib/vault'
import { BATTERY, stepTitle } from '../data/sessionTemplates'
import { GAMES } from '../data/games'
import { GAME_REGISTRY } from '../games/registry'
import { FELT_LABELS } from '../games/engine/felt'
import { isLowerBetter, metricLabel } from '../games/engine/metrics'
import AdaptationsEditor from '../components/specialist/AdaptationsEditor'
import VaultPanel from '../components/specialist/VaultPanel'
import '../components/specialist/Specialist.css'
import './StudentFile.css'

const PLAYABLE = GAMES.filter((game) => game.status === 'available')
const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShort(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

/* ───────────────────────────── Цілі ІПР ───────────────────────────── */

function Goals({ studentId, results }) {
  const [goals, setGoals] = useState([])
  const [available, setAvailable] = useState(true)
  const [gameId, setGameId] = useState(PLAYABLE[0]?.id ?? '')
  const [levelId, setLevelId] = useState('')
  const [metric, setMetric] = useState('score')
  const [target, setTarget] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listGoals(studentId)
      .then((data) => {
        if (cancelled) return
        if (data === null) setAvailable(false)
        else setGoals(data)
      })
      .catch(() => !cancelled && setError('Не вдалося завантажити цілі.'))
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!available) return null

  const options = metricOptions(gameId, results)
  const levels = GAME_REGISTRY[gameId]?.config.levels ?? []

  async function handleAdd(event) {
    event.preventDefault()
    setError(null)
    if (target === '' || !Number.isFinite(Number(target))) {
      setError('Вкажи ціль числом.')
      return
    }
    try {
      const created = await createGoal({ studentId, gameId, levelId, metric, target, dueOn })
      setGoals((list) => [...list, created])
      setTarget('')
    } catch {
      setError('Не вдалося зберегти ціль.')
    }
  }

  async function handleClose(goal) {
    try {
      await closeGoal(goal.id)
      setGoals((list) =>
        list.map((item) =>
          item.id === goal.id ? { ...item, closed_at: new Date().toISOString() } : item,
        ),
      )
    } catch {
      setError('Не вдалося закрити ціль.')
    }
  }

  async function handleDelete(goal) {
    if (!window.confirm('Видалити ціль? Прогрес рахується зі спроб, тож спроби лишаться.')) return
    try {
      await deleteGoal(goal.id)
      setGoals((list) => list.filter((item) => item.id !== goal.id))
    } catch {
      setError('Не вдалося видалити ціль.')
    }
  }

  return (
    <section className="specialist-card">
      <h2>
        <Goal size={20} aria-hidden="true" /> Цілі ІПР
      </h2>
      <p className="vault__note">
        Ціль прив’язана до показника гри. «Зараз» — медіана трьох останніх спроб після постановки
        цілі: одна вдала спроба — ще не навичка.
      </p>

      {goals.length > 0 && (
        <ul className="specialist-list">
          {goals.map((goal) => {
            const progress = goalProgress(goal, results)
            const lower = goal.direction === 'at_most'
            const percent =
              progress.current === null
                ? 0
                : lower
                  ? Math.min(
                      100,
                      Math.round((goal.target / Math.max(progress.current, 1e-9)) * 100),
                    )
                  : Math.min(
                      100,
                      Math.round((progress.current / Math.max(goal.target, 1e-9)) * 100),
                    )
            return (
              <li key={goal.id} className="specialist-list__item">
                <div className="specialist-list__head">
                  <span>{goalTitle(goal)}</span>
                  <span className="specialist-muted">
                    {goal.closed_at
                      ? 'закрито'
                      : progress.achieved && progress.stable
                        ? 'досягнуто стабільно'
                        : progress.achieved
                          ? 'досягнуто (ще не стабільно)'
                          : progress.daysLeft !== null
                            ? progress.daysLeft >= 0
                              ? `лишилось ${progress.daysLeft} дн.`
                              : 'строк минув'
                            : ''}
                  </span>
                </div>
                <div
                  className="specialist-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label="Наскільки близько до цілі"
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p className="specialist-muted">
                  {progress.current === null
                    ? 'Ще немає спроб після постановки цілі.'
                    : `Зараз: ${progress.current}, найкраще: ${progress.best}, ціль: ${goal.target}` +
                      (progress.remaining ? ` — лишилось ${progress.remaining}` : '') +
                      ` (спроб: ${progress.attempts})`}
                </p>
                {!goal.closed_at && (
                  <div className="vault__row">
                    <button
                      type="button"
                      className="specialist-button specialist-button--secondary"
                      onClick={() => handleClose(goal)}
                    >
                      Закрити ціль
                    </button>
                    <button
                      type="button"
                      className="specialist-button specialist-button--secondary"
                      onClick={() => handleDelete(goal)}
                    >
                      Видалити
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form
        className="specialist-form"
        onSubmit={handleAdd}
        style={{ marginTop: 'var(--space-4)' }}
      >
        <label>
          Гра
          <select
            value={gameId}
            onChange={(event) => {
              setGameId(event.target.value)
              setLevelId('')
              setMetric('score')
            }}
          >
            {PLAYABLE.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Рівень
          <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="">Будь-який</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Показник
          <select value={metric} onChange={(event) => setMetric(event.target.value)}>
            {options.map((key) => (
              <option key={key} value={key}>
                {goalMetricLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {isLowerBetter(metric) ? 'Не більше ніж' : 'Не менше ніж'}
          <input
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            style={{ width: '8em' }}
          />
        </label>
        <label>
          До якого дня
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </label>
        <button type="submit" className="specialist-button">
          Додати ціль
        </button>
      </form>
      {error && <p className="specialist-error">{error}</p>}
    </section>
  )
}

/* ───────────────────────────── Зріз ───────────────────────────── */

const BATTERY_METRICS = ['accuracy_pct', 'avg_rt_ms', 'rt_cv_pct', 'span', 'duration_ms', 'errors']

function Battery({ groupId, studentId, plans, runs, results, onAssigned }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { slices, sameConditions } = batterySlices(plans, runs, results)
  const window_ = nextBatteryWindow(slices)
  const pending = plans.find(
    (plan) =>
      plan.kind === 'battery' &&
      plan.student_id === studentId &&
      !plan.archived_at &&
      !runs.some((run) => run.plan_id === plan.id && run.finished_at),
  )

  const games = BATTERY.steps.filter((step) => step.kind === 'game')

  async function handleAssign() {
    setBusy(true)
    setError(null)
    try {
      await createPlan({
        groupId,
        studentId,
        kind: 'battery',
        title: BATTERY.title,
        steps: BATTERY.steps,
      })
      onAssigned()
    } catch {
      setError('Не вдалося призначити зріз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="specialist-card">
      <h2>
        <ChartLine size={20} aria-hidden="true" /> Зріз «до/після»
      </h2>
      <p className="vault__note">{BATTERY.about}</p>

      {slices.length > 0 && (
        <div className="specialist-table-wrap">
          <table className="specialist-table">
            <thead>
              <tr>
                <th>Гра · показник</th>
                {slices.map((slice) => (
                  <th key={slice.runId}>{formatShort(slice.date)}</th>
                ))}
                {slices.length > 1 && <th>Зміна</th>}
              </tr>
            </thead>
            <tbody>
              {games.flatMap((step) => {
                const rows = [['score', 'Бал']]
                for (const key of BATTERY_METRICS) {
                  if (
                    slices.some((slice) =>
                      Number.isFinite(slice.byGame[step.gameId]?.metrics?.[key]),
                    )
                  ) {
                    rows.push([key, metricLabel(key)])
                  }
                }
                return rows.map(([key, label]) => {
                  const values = slices.map((slice) => {
                    const data = slice.byGame[step.gameId]
                    if (!data) return null
                    const value = key === 'score' ? data.score : data.metrics[key]
                    return Number.isFinite(value) ? value : null
                  })
                  const first = values.find((value) => value !== null)
                  const last = [...values].reverse().find((value) => value !== null)
                  const delta = first !== undefined && last !== undefined ? last - first : null
                  const better =
                    delta !== null && delta !== 0 && (isLowerBetter(key) ? delta < 0 : delta > 0)
                  return (
                    <tr key={`${step.gameId}-${key}`}>
                      <td>
                        {key === 'score' ? (
                          <strong>{GAME_TITLES[step.gameId]}</strong>
                        ) : (
                          <span className="student-file__metric">{label}</span>
                        )}
                        {key === 'score' && ` · ${label}`}
                      </td>
                      {values.map((value, i) => (
                        <td key={slices[i].runId}>{value ?? '—'}</td>
                      ))}
                      {slices.length > 1 && (
                        <td className={better ? 'student-file__better' : undefined}>
                          {delta === null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                        </td>
                      )}
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      )}

      {slices.length > 1 && !sameConditions && (
        <p className="specialist-error">
          Профіль адаптацій між зрізами змінювався — порівнюй обережно: умови вже не однакові.
        </p>
      )}

      {slices.length === 0 && <p>Зрізів ще не було. Перший зріз — це точка «до».</p>}

      {window_ && (
        <p>
          Наступний зріз радимо між {formatDate(window_.from.toISOString())} і{' '}
          {formatDate(window_.to.toISOString())}.
        </p>
      )}

      {pending ? (
        <p className="specialist-muted">
          Зріз призначено — дитина побачить його в каталозі як заняття.
        </p>
      ) : (
        <button type="button" className="specialist-button" onClick={handleAssign} disabled={busy}>
          Призначити зріз
        </button>
      )}
      {error && <p className="specialist-error">{error}</p>}
    </section>
  )
}

/* ─────────────────────── Заняття й щоденник ─────────────────────── */

function RunMoods({ run }) {
  const vault = useVaultState()
  const [moods, setMoods] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!vault.privateKey) return undefined
    Promise.all([
      readSealed(run.mood_before, moodContext(run.id, 'before')),
      readSealed(run.mood_after, moodContext(run.id, 'after')),
      readSealed(run.reflection, moodContext(run.id, 'reflection')),
    ]).then(([before, after, reflection]) => {
      if (!cancelled) setMoods({ before, after, reflection })
    })
    return () => {
      cancelled = true
    }
  }, [run, vault.privateKey])

  if (!run.mood_before && !run.mood_after && !run.reflection) {
    return <span className="specialist-muted">настрій не збережено</span>
  }
  if (!vault.privateKey || !moods)
    return <span className="specialist-muted">настрій — відімкни щоденник</span>
  return (
    <span>
      Настрій: {MOOD_LABELS[moods.before?.mood] ?? '—'} → {MOOD_LABELS[moods.after?.mood] ?? '—'}
      {moods.reflection?.felt && ` · «${FELT_LABELS[moods.reflection.felt]}»`}
    </span>
  )
}

function DiaryForm({ studentId, runId, publicKey, onAdded }) {
  const [help, setHelp] = useState(null)
  const [behavior, setBehavior] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!publicKey) return
    setBusy(true)
    setError(null)
    try {
      const row = await addDiaryEntry({
        studentId,
        runId,
        entry: { help, behavior, note },
        publicKey,
      })
      setHelp(null)
      setBehavior([])
      setNote('')
      onAdded(row)
    } catch {
      setError('Не вдалося зберегти запис.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="student-file__diary-form" onSubmit={handleSubmit}>
      <p className="adaptations-form__label">Рівень допомоги</p>
      <div className="specialist-chips">
        {HELP_LEVELS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={help === item.id ? 'specialist-chip is-on' : 'specialist-chip'}
            aria-pressed={help === item.id}
            onClick={() => setHelp(help === item.id ? null : item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="adaptations-form__label">Поведінка</p>
      <div className="specialist-chips">
        {BEHAVIORS.map((item) => {
          const on = behavior.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              className={on ? 'specialist-chip is-on' : 'specialist-chip'}
              aria-pressed={on}
              onClick={() =>
                setBehavior((list) =>
                  on ? list.filter((id) => id !== item.id) : [...list, item.id],
                )
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <label className="vault__field" style={{ marginTop: 'var(--space-3)' }}>
        <span>Нотатка</span>
        <textarea
          className="student-file__note"
          value={note}
          maxLength={4000}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button type="submit" className="specialist-button" disabled={busy || !publicKey}>
        {busy ? 'Шифруємо й зберігаємо…' : 'Зберегти запис'}
      </button>
      {error && <p className="specialist-error">{error}</p>}
    </form>
  )
}

function Diary({ studentId, runs, plans, results, vaultRecord }) {
  const vault = useVaultState()
  const [rows, setRows] = useState([])
  const [entries, setEntries] = useState([])
  const [available, setAvailable] = useState(true)
  const [forRun, setForRun] = useState('')

  useEffect(() => {
    let cancelled = false
    listDiary(studentId)
      .then((data) => {
        if (cancelled) return
        if (data === null) setAvailable(false)
        else setRows(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [studentId])

  useEffect(() => {
    let cancelled = false
    // Замкнено — нічого не розшифровуємо; показ і так ховає старі записи.
    if (!vault.privateKey) return undefined
    openDiary(rows).then((opened) => !cancelled && setEntries(opened))
    return () => {
      cancelled = true
    }
  }, [rows, vault.privateKey])

  const plansById = new Map(plans.map((plan) => [plan.id, plan]))

  async function handleDelete(id) {
    if (!window.confirm('Видалити запис щоденника назавжди?')) return
    try {
      await deleteDiaryEntry(id)
      setRows((list) => list.filter((row) => row.id !== id))
    } catch {
      // Запис лишиться; повторити можна.
    }
  }

  return (
    <>
      <section className="specialist-card">
        <h2>
          <CalendarCheck size={20} aria-hidden="true" /> Заняття
        </h2>
        {runs.length === 0 ? (
          <p>Ця дитина ще не проходила занять.</p>
        ) : (
          <ul className="specialist-list">
            {runs.map((run) => {
              const plan = plansById.get(run.plan_id)
              if (!plan) return null
              const report = runReport(plan, run, results)
              return (
                <li key={run.id} className="specialist-list__item">
                  <div className="specialist-list__head">
                    <span>
                      {plan.title} · {formatDate(run.started_at)}
                    </span>
                    <span className="specialist-muted">
                      {report.finished ? `завершено за ${report.minutes} хв` : 'не завершено'} ·
                      кроків {report.done} з {report.total}
                    </span>
                  </div>
                  <ul className="student-file__steps">
                    {report.steps.map((item) => (
                      <li key={item.index} className={`is-${item.status}`}>
                        {stepTitle(item.step)}
                        {item.status === 'skipped' && ' — пропущено'}
                        {item.status === 'pending' && ' — не дійшли'}
                        {item.attempt && ` — бал ${item.attempt.score}`}
                        {item.attempt?.metrics?.accuracy_pct !== undefined &&
                          `, точність ${item.attempt.metrics.accuracy_pct}%`}
                      </li>
                    ))}
                  </ul>
                  <RunMoods run={run} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {available && (
        <section className="specialist-card">
          <h2>
            <BookLock size={20} aria-hidden="true" /> Щоденник фахівця
          </h2>
          {!vaultRecord && (
            <p className="specialist-muted">
              Щоб вести щоденник, спершу створи його вгорі сторінки.
            </p>
          )}
          {vaultRecord && (
            <>
              <label className="vault__field">
                <span>Запис про</span>
                <select value={forRun} onChange={(event) => setForRun(event.target.value)}>
                  <option value="">Загальне спостереження</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {plansById.get(run.plan_id)?.title ?? 'Заняття'} ·{' '}
                      {formatShort(run.started_at)}
                    </option>
                  ))}
                </select>
              </label>
              <DiaryForm
                studentId={studentId}
                runId={forRun || null}
                publicKey={vaultRecord.public_key}
                onAdded={(row) => setRows((list) => [row, ...list])}
              />
            </>
          )}

          {rows.length > 0 && !vault.privateKey && (
            <p className="specialist-muted">
              Записів: {rows.length}. Відімкни щоденник, щоб прочитати.
            </p>
          )}

          {vault.privateKey && entries.length > 0 && (
            <ul className="specialist-list" style={{ marginTop: 'var(--space-4)' }}>
              {entries.map((row) => (
                <li key={row.id} className="specialist-list__item">
                  <div className="specialist-list__head">
                    <span>{formatDate(row.created_at)}</span>
                    <button
                      type="button"
                      className="specialist-chip"
                      onClick={() => handleDelete(row.id)}
                      aria-label="Видалити запис"
                    >
                      Видалити
                    </button>
                  </div>
                  {row.entry ? (
                    <>
                      <p className="specialist-muted">
                        {[
                          row.entry.help && `Допомога: ${HELP_LABELS[row.entry.help]}`,
                          row.entry.behavior?.length &&
                            row.entry.behavior.map((id) => BEHAVIOR_LABELS[id]).join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {row.entry.note && (
                        <p className="student-file__note-text">{row.entry.note}</p>
                      )}
                    </>
                  ) : (
                    <p className="specialist-error">Запис не відкривається цим ключем.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

/* ───────────────────────────── Сторінка ───────────────────────────── */

function StudentFile() {
  const { groupId, studentId } = useParams()
  const { user, loading } = useAuth()
  const [student, setStudent] = useState(null)
  const [adaptations, setAdaptations] = useState(undefined)
  const [results, setResults] = useState([])
  const [plans, setPlans] = useState([])
  const [runs, setRuns] = useState([])
  const [vaultRecord, setVaultRecord] = useState(null)
  const [error, setError] = useState(null)

  const loadSessions = useCallback(async () => {
    const [planList, runList] = await Promise.all([
      listGroupPlans(groupId),
      listRunsForStudent(studentId),
    ])
    setPlans(planList ?? [])
    setRuns(runList)
  }, [groupId, studentId])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false

    async function load() {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, group_id')
        .eq('id', studentId)
        .maybeSingle()
      if (profileError || !profile || profile.group_id !== groupId) {
        throw new Error('not_found')
      }
      const [{ data: attempts }, profiles] = await Promise.all([
        supabase
          .from('results')
          .select('user_id, game_id, level_id, score, metrics, played_at')
          .eq('user_id', studentId)
          .order('played_at', { ascending: true }),
        listStudentAdaptations([studentId]).catch(() => null),
      ])
      if (cancelled) return
      setStudent(profile)
      setResults(attempts ?? [])
      setAdaptations(profiles === null ? null : (profiles[studentId] ?? {}))
      await loadSessions()
    }

    load().catch(
      () => !cancelled && setError('Учня не знайдено або в тебе немає до нього доступу.'),
    )
    return () => {
      cancelled = true
    }
  }, [user, groupId, studentId, loadSessions])

  if (!isCloudConfigured) {
    return (
      <section className="student-file">
        <h1>Картка дитини</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) return null

  if (!user) {
    return (
      <section className="student-file">
        <h1>Картка дитини</h1>
        <p>Спершу увійди на сторінці входу.</p>
        <Link to="/login">До входу</Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="student-file">
        <h1>Картка дитини</h1>
        <p className="specialist-error">{error}</p>
        <Link to={`/groups/${groupId}`}>← До групи</Link>
      </section>
    )
  }

  if (!student) {
    return (
      <section className="student-file">
        <h1>Картка дитини</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  return (
    <section className="student-file">
      <Link to={`/groups/${groupId}`} className="group-detail__back">
        ← До групи
      </Link>
      <h1>{student.display_name ?? 'Учень'}</h1>

      {/*
        Щоденник — нагорі: його ключ потрібен і настрою в заняттях, і самим
        записам. Без створеного щоденника настрій дітей не зберігається.
      */}
      <VaultPanel onReady={setVaultRecord} />

      <section className="specialist-card">
        <h2>
          <Settings2 size={20} aria-hidden="true" /> Профіль адаптацій
        </h2>
        {adaptations === undefined ? (
          <p>Завантаження…</p>
        ) : adaptations === null ? (
          <p>
            Профіль ще не ввімкнено на сервері: адміністраторові треба застосувати міграцію
            20261002_specialist_tools.sql.
          </p>
        ) : (
          <AdaptationsEditor student={student} initial={adaptations} onSaved={setAdaptations} />
        )}
      </section>

      <Goals studentId={studentId} results={results} />

      <Battery
        groupId={groupId}
        studentId={studentId}
        plans={plans}
        runs={runs}
        results={results}
        onAssigned={() => loadSessions().catch(() => {})}
      />

      <Diary
        studentId={studentId}
        runs={runs}
        plans={plans}
        results={results}
        vaultRecord={vaultRecord}
      />
    </section>
  )
}

export default StudentFile
