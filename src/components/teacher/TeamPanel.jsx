import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, X } from 'lucide-react'
import {
  TEAM_ERROR,
  TEAM_ERROR_TEXT,
  addGroupSpecialist,
  listGroupTeam,
  removeGroupSpecialist,
} from '../../lib/team'
import './TeamPanel.css'

function errorText(caught) {
  return TEAM_ERROR_TEXT[caught?.reason] ?? TEAM_ERROR_TEXT[TEAM_ERROR.UNKNOWN]
}

/**
 * Хто веде групу: власник і фахівці.
 *
 * Логопед, психолог і вчитель однієї дитини досі не могли бачити спільних
 * результатів: доступ мав лише той, хто створив групу. Власник додає колегу
 * за поштою; колега бачить дітей, результати й заняття, дає завдання і веде
 * свій щоденник. Видалити дитину чи змінити склад групи може лише власник.
 *
 * Без міграції 20261015 розділ не показується зовсім — нема чого обіцяти.
 */
function TeamPanel({ groupId, userId, isOwner }) {
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function reload() {
    setTeam(await listGroupTeam(groupId))
  }

  useEffect(() => {
    let cancelled = false
    listGroupTeam(groupId)
      .then((rows) => {
        if (!cancelled) setTeam(rows)
      })
      .catch(() => {
        if (!cancelled) setTeam(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (team === undefined || team === null) return null

  async function add(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await addGroupSpecialist(groupId, email)
      setMessage(`${email.trim()} тепер бачить цю групу.`)
      setEmail('')
      await reload()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(member) {
    const leaving = member.userId === userId
    const confirmed = window.confirm(
      leaving
        ? 'Вийти з цієї групи? Ви більше не бачитимете дітей і їхніх результатів. Ваш щоденник лишиться у вас.'
        : `Прибрати ${member.email ?? member.displayName} з групи? Колега більше не бачитиме дітей.`,
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      await removeGroupSpecialist(groupId, member.userId)
      if (leaving) {
        navigate('/groups', { replace: true })
        return
      }
      await reload()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="team print-hide" aria-labelledby="team-title">
      <h2 id="team-title">
        <Users size={20} aria-hidden="true" /> Хто веде групу
      </h2>
      <ul className="team__list">
        {team.map((member) => (
          <li key={member.userId} className="team__member">
            <span className="team__who">
              <strong>{member.displayName ?? member.email}</strong>
              {member.email && member.displayName && (
                <span className="team__email">{member.email}</span>
              )}
            </span>
            <span className="team__role">{member.isOwner ? 'створив групу' : 'фахівець'}</span>
            {!member.isOwner && (isOwner || member.userId === userId) && (
              <button
                type="button"
                className="team__remove"
                disabled={busy}
                aria-label={
                  member.userId === userId
                    ? 'Вийти з групи'
                    : `Прибрати ${member.email ?? member.displayName} з групи`
                }
                onClick={() => remove(member)}
              >
                <X size={16} aria-hidden="true" />
                {member.userId === userId ? 'Вийти' : null}
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form className="team__form" onSubmit={add}>
          <label className="team__label" htmlFor="team-email">
            Додати колегу — пошта, з якою він входить на сайт
          </label>
          <div className="team__row">
            <input
              id="team-email"
              className="team__input"
              type="email"
              autoComplete="off"
              value={email}
              placeholder="logoped@school.ua"
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" className="team__add" disabled={busy || email.trim() === ''}>
              Додати
            </button>
          </div>
          <p className="team__note">
            Колега бачитиме дітей, результати й заняття, зможе давати завдання й вести свій
            щоденник. Видалити дитину чи змінити склад групи може лише той, хто її створив.
          </p>
        </form>
      ) : (
        <p className="team__note">
          Вас додано фахівцем. Видалити дитину чи змінити склад групи може лише той, хто її
          створив.
        </p>
      )}

      {error && <p className="team__error">{error}</p>}
      {message && (
        <p className="team__message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}

export default TeamPanel
