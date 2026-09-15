import { useEffect, useState } from 'react'
import { Trash2, ClipboardList } from 'lucide-react'
import { GAMES } from '../../data/games'
import { GAME_REGISTRY } from '../../games/registry'
import {
  assignmentProgress,
  createAssignment,
  deleteAssignment,
  isOverdue,
  listAssignments,
} from '../../lib/assignments'
import './Assignments.css'

const PLAYABLE = GAMES.filter((game) => game.status === 'available')
const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function levelsOf(gameId) {
  return GAME_REGISTRY[gameId]?.config.levels ?? []
}

function formatDue(due) {
  if (!due) return 'без строку'
  return `до ${new Date(due).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`
}

function Assignments({ groupId, students, results }) {
  const [assignments, setAssignments] = useState([])
  // null означає «таблиці ще немає»: міграція не застосована, і показувати тут
  // нічого — див. isMissingTable.
  const [available, setAvailable] = useState(true)
  const [gameId, setGameId] = useState(PLAYABLE[0]?.id ?? '')
  const [levelId, setLevelId] = useState('')
  const [targetAttempts, setTargetAttempts] = useState(1)
  const [dueOn, setDueOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    let cancelled = false
    listAssignments(groupId)
      .then((data) => {
        if (cancelled) return
        if (data === null) setAvailable(false)
        else setAssignments(data)
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Не вдалося завантажити завдання.')
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (!available) return null

  async function handleСreateAssignment(event) {
    event.preventDefault()
    setBusy(true)
    setErrorMessage(null)
    try {
      const created = await createAssignment({
        groupId,
        gameId,
        levelId,
        targetAttempts: Number(targetAttempts),
        dueOn,
      })
      setAssignments((list) => [created, ...list])
      setDueOn('')
    } catch {
      setErrorMessage('Не вдалося зберегти завдання. Спробуй ще раз.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    setBusy(true)
    try {
      await deleteAssignment(id)
      setAssignments((list) => list.filter((item) => item.id !== id))
    } catch {
      setErrorMessage('Не вдалося зняти завдання.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="assignments">
      <h2>
        <ClipboardList size={20} aria-hidden="true" />
        Завдання класу
      </h2>
      <p className="assignments__lead">
        Назви одну гру всьому класу й дивись, хто її зробив. Решта ігор
        лишається відкритою — це не заборона, а орієнтир.
      </p>

      <form className="assignments__form" onSubmit={handleСreateAssignment}>
        <label className="assignments__field">
          <span>Гра</span>
          <select
            value={gameId}
            onChange={(event) => {
              setGameId(event.target.value)
              // Рівні в кожної гри свої: лишити старий вибір означало б
              // зберегти рівень, якого в новій грі не існує.
              setLevelId('')
            }}
          >
            {PLAYABLE.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </label>

        <label className="assignments__field">
          <span>Рівень</span>
          <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="">Будь-який</option>
            {levelsOf(gameId).map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </label>

        <label className="assignments__field assignments__field--narrow">
          <span>Скільки разів</span>
          <input
            type="number"
            min="1"
            max="20"
            value={targetAttempts}
            onChange={(event) => setTargetAttempts(event.target.value)}
          />
        </label>

        <label className="assignments__field">
          <span>До якого дня</span>
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </label>

        <button type="submit" className="assignments__submit" disabled={busy}>
          Задати
        </button>
      </form>

      {errorMessage && <p className="assignments__error">{errorMessage}</p>}

      {assignments.length === 0 ? (
        <p className="assignments__empty">Поки нічого не задано.</p>
      ) : (
        <ul className="assignments__list">
          {assignments.map((assignment) => {
            const progress = assignmentProgress(assignment, students, results)
            const overdue = isOverdue(assignment)

            return (
              <li key={assignment.id} className="assignments__item">
                <div className="assignments__item-head">
                  <span className="assignments__game">
                    {GAME_TITLES[assignment.game_id] ?? assignment.game_id}
                  </span>
                  <span className="assignments__meta">
                    {assignment.target_attempts}×
                    {assignment.level_id ? ` · ${assignment.level_id}` : ''} ·{' '}
                    <span className={overdue ? 'assignments__due is-overdue' : 'assignments__due'}>
                      {formatDue(assignment.due_on)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="assignments__remove"
                    onClick={() => handleDelete(assignment.id)}
                    aria-label={`Зняти завдання ${GAME_TITLES[assignment.game_id] ?? assignment.game_id}`}
                    disabled={busy}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="assignments__progress">
                  <div
                    className="assignments__bar"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Скільки учнів виконали"
                  >
                    <span style={{ width: `${progress.percent}%` }} />
                  </div>
                  <span className="assignments__count">
                    {progress.done.length} з {progress.total}
                  </span>
                </div>

                {/* Імена тих, хто ще не зробив, — це і є відповідь на питання,
                    заради якого вчитель сюди дивиться. */}
                {progress.pending.length > 0 && (
                  <p className="assignments__pending">
                    Ще не зробили: {progress.pending.map((student) => student.displayName).join(', ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default Assignments
