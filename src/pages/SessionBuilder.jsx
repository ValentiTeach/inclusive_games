import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { getGroupDetails } from '../lib/groups'
import { createPlan, deleteTemplate, listMyTemplates, saveTemplate } from '../lib/sessions'
import {
  STEP_KINDS,
  TEMPLATE_LIBRARY,
  newStep,
  normalizeSteps,
  stepTitle,
} from '../data/sessionTemplates'
import { GAMES } from '../data/games'
import { GAME_REGISTRY } from '../games/registry'
import '../components/specialist/Specialist.css'
import './SessionBuilder.css'

const PLAYABLE = GAMES.filter((game) => game.status === 'available')

/**
 * Конструктор корекційного заняття.
 *
 * Почати можна з готового шаблону бібліотеки, зі свого або з порожнього; далі
 * кроки додаються, прибираються й переставляються. Призначене заняття — це
 * копія кроків: шаблон можна правити далі, а вже проведені заняття лишаться
 * такими, якими були.
 *
 * «Зіграй тричі» — це просто заняття з одного кроку гри; окремий механізм для
 * нього не потрібен (старі завдання лишились, щоб не ламати вже видані).
 */
function SessionBuilder() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [students, setStudents] = useState([])
  const [mine, setMine] = useState([])
  const [title, setTitle] = useState(TEMPLATE_LIBRARY[0].title)
  const [steps, setSteps] = useState(TEMPLATE_LIBRARY[0].steps)
  const [maxMinutes, setMaxMinutes] = useState(TEMPLATE_LIBRARY[0].maxMinutes ?? '')
  const [breakEvery, setBreakEvery] = useState(TEMPLATE_LIBRARY[0].breakEveryMinutes ?? '')
  const [studentId, setStudentId] = useState('')
  const [addKind, setAddKind] = useState('game')
  const [addGame, setAddGame] = useState(PLAYABLE[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    getGroupDetails(groupId)
      .then((data) => !cancelled && setStudents(data.students))
      .catch(() => {})
    listMyTemplates()
      .then((data) => !cancelled && setMine(data ?? []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, groupId])

  if (!isCloudConfigured) {
    return (
      <section className="session-builder">
        <h1>Нове заняття</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) return null

  if (!user) {
    return (
      <section className="session-builder">
        <h1>Нове заняття</h1>
        <Link to="/login">До входу</Link>
      </section>
    )
  }

  function applyTemplate(template) {
    setTitle(template.title)
    setSteps(normalizeSteps(template.steps))
    setMaxMinutes(template.maxMinutes ?? template.max_minutes ?? '')
    setBreakEvery(template.breakEveryMinutes ?? template.break_every_minutes ?? '')
    setMessage(null)
  }

  function updateStep(index, patch) {
    setSteps((list) => list.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  function moveStep(index, delta) {
    setSteps((list) => {
      const next = [...list]
      const target = index + delta
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeStep(index) {
    setSteps((list) => list.filter((_, i) => i !== index))
  }

  function addStep() {
    setSteps((list) => [...list, newStep(addKind, addGame)])
  }

  const limits = {
    maxMinutes: maxMinutes ? Number(maxMinutes) : null,
    breakEveryMinutes: breakEvery ? Number(breakEvery) : null,
  }
  const cleanSteps = normalizeSteps(steps)
  const valid = title.trim() && cleanSteps.length > 0

  async function handleSaveTemplate() {
    setBusy(true)
    setMessage(null)
    try {
      const saved = await saveTemplate({ title, steps: cleanSteps, ...limits })
      setMine((list) => [saved, ...list])
      setMessage('Шаблон збережено — він з’явиться серед твоїх.')
    } catch {
      setMessage('Не вдалося зберегти шаблон.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssign() {
    setBusy(true)
    setMessage(null)
    try {
      await createPlan({ groupId, studentId, title, steps: cleanSteps, ...limits })
      navigate(`/groups/${groupId}`, { state: { sessionAssigned: true } })
    } catch {
      setMessage(
        'Не вдалося призначити. Можливо, міграцію 20261002_specialist_tools.sql ще не застосовано.',
      )
      setBusy(false)
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm('Видалити шаблон? Уже призначені заняття не зміняться.')) return
    try {
      await deleteTemplate(id)
      setMine((list) => list.filter((item) => item.id !== id))
    } catch {
      setMessage('Не вдалося видалити шаблон.')
    }
  }

  return (
    <section className="session-builder">
      <Link to={`/groups/${groupId}`} className="group-detail__back">
        ← До групи
      </Link>
      <h1>Нове заняття</h1>

      <div className="specialist-card">
        <h2>Почати з шаблону</h2>
        <ul className="session-builder__templates">
          {TEMPLATE_LIBRARY.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="session-builder__template"
                onClick={() => applyTemplate(template)}
              >
                <strong>{template.title}</strong>
                <span>{template.about}</span>
              </button>
            </li>
          ))}
          {mine.map((template) => (
            <li key={template.id} className="session-builder__mine">
              <button
                type="button"
                className="session-builder__template"
                onClick={() => applyTemplate(template)}
              >
                <strong>{template.title}</strong>
                <span>Мій шаблон · {template.steps.length} кроків</span>
              </button>
              <button
                type="button"
                className="group-detail__icon-btn group-detail__icon-btn--danger"
                aria-label={`Видалити шаблон ${template.title}`}
                onClick={() => handleDeleteTemplate(template.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="session-builder__template"
              onClick={() =>
                applyTemplate({
                  title: 'Моє заняття',
                  steps: [{ kind: 'greeting' }, { kind: 'reflection' }],
                  maxMinutes: 25,
                  breakEveryMinutes: 10,
                })
              }
            >
              <strong>Порожнє</strong>
              <span>Лише привітання й рефлексія — решту додаси сам.</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="specialist-card">
        <label className="vault__field">
          <span>Назва заняття</span>
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <h2>Кроки</h2>
        <ol className="session-builder__steps">
          {steps.map((step, index) => {
            const levels =
              step.kind === 'game' ? (GAME_REGISTRY[step.gameId]?.config.levels ?? []) : []
            return (
              <li key={`${index}-${step.kind}`} className="session-builder__step">
                <span className="session-builder__step-title">
                  {index + 1}. {stepTitle(step)}
                </span>
                <span className="session-builder__step-options">
                  {step.kind === 'game' && (
                    <select
                      aria-label={`Рівень для кроку ${index + 1}`}
                      value={step.levelId ?? ''}
                      onChange={(event) =>
                        updateStep(index, { levelId: event.target.value || undefined })
                      }
                    >
                      <option value="">Рівень добирається сам</option>
                      {levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {(step.kind === 'breathing' || step.kind === 'movement') && (
                    <label className="session-builder__seconds">
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={step.seconds}
                        onChange={(event) => updateStep(index, { seconds: event.target.value })}
                        aria-label={`Тривалість кроку ${index + 1}, секунд`}
                      />
                      с
                    </label>
                  )}
                </span>
                <span className="session-builder__step-actions">
                  <button
                    type="button"
                    className="group-detail__icon-btn"
                    aria-label={`Крок ${index + 1} вище`}
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="group-detail__icon-btn"
                    aria-label={`Крок ${index + 1} нижче`}
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="group-detail__icon-btn group-detail__icon-btn--danger"
                    aria-label={`Прибрати крок ${index + 1}`}
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="specialist-form">
          <label>
            Додати крок
            <select value={addKind} onChange={(event) => setAddKind(event.target.value)}>
              {Object.entries(STEP_KINDS).map(([kind, info]) => (
                <option key={kind} value={kind}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          {addKind === 'game' && (
            <label>
              Гра
              <select value={addGame} onChange={(event) => setAddGame(event.target.value)}>
                {PLAYABLE.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="specialist-button specialist-button--secondary"
            onClick={addStep}
            disabled={steps.length >= 20}
          >
            <Plus size={16} aria-hidden="true" /> Додати
          </button>
        </div>
      </div>

      <div className="specialist-card">
        <h2>Тривалість і кому</h2>
        <div className="specialist-form">
          <label>
            Не довше ніж, хв
            <input
              type="number"
              min={5}
              max={120}
              value={maxMinutes}
              placeholder="без обмеження"
              onChange={(event) => setMaxMinutes(event.target.value)}
            />
          </label>
          <label>
            Перерва кожні, хв
            <input
              type="number"
              min={3}
              max={60}
              value={breakEvery}
              placeholder="без перерв"
              onChange={(event) => setBreakEvery(event.target.value)}
            />
          </label>
          <label>
            Кому
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">Усій групі</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="vault__note">
          Коли час вийде, решта кроків пропускається, але рефлексія лишається. Перерва пропонується
          лише між кроками — посеред гри дитину ніхто не зупинить.
        </p>

        <div className="vault__row">
          <button
            type="button"
            className="specialist-button"
            onClick={handleAssign}
            disabled={busy || !valid}
          >
            Призначити
          </button>
          <button
            type="button"
            className="specialist-button specialist-button--secondary"
            onClick={handleSaveTemplate}
            disabled={busy || !valid}
          >
            Зберегти як мій шаблон
          </button>
          <Link
            className="specialist-button specialist-button--secondary session-builder__preview"
            to="/session/preview"
            state={{
              preview: {
                id: 'preview',
                kind: 'session',
                title,
                steps: cleanSteps,
                max_minutes: limits.maxMinutes,
                break_every_minutes: limits.breakEveryMinutes,
              },
            }}
          >
            <Eye size={16} aria-hidden="true" /> Переглянути як дитина
          </Link>
        </div>
        {message && (
          <p className="vault__note" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}

export default SessionBuilder
