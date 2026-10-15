import { useEffect, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { GAMES } from '../../data/games'
import { goalTitle, listOpenGoals } from '../../lib/goals'
import { NOTABLE_CHANGE, WEEK_DAYS, weeklyDigest } from '../../lib/weeklyDigest'
import Avatar from '../ui/Avatar'
import './WeeklyDigest.css'

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
}

function Name({ student }) {
  return (
    <span className="digest__name">
      <Avatar avatarKey={student.avatar} size="sm" />
      {student.displayName}
    </span>
  )
}

/**
 * Підсумок тижня: хто не грав, у кого помітно змінився бал, хто досяг цілі.
 * Те, що вчитель інакше вишукував би в таблиці й зрізі за іграми сам.
 *
 * Цілі ІПР підтягуються окремо й мовчки: без міграції таблиці немає, і це не
 * привід ховати решту підсумку.
 */
function WeeklyDigest({ students, results }) {
  const [goals, setGoals] = useState([])
  const studentKey = students.map((student) => student.id).join(',')

  useEffect(() => {
    if (!studentKey) return undefined
    let cancelled = false
    listOpenGoals(studentKey.split(','))
      .then((rows) => {
        if (!cancelled) setGoals(rows ?? [])
      })
      .catch(() => {
        if (!cancelled) setGoals([])
      })
    return () => {
      cancelled = true
    }
  }, [studentKey])

  if (students.length === 0) return null

  const digest = weeklyDigest({ students, results, goals })
  const quiet =
    digest.inactive.length === 0 &&
    digest.drops.length === 0 &&
    digest.rises.length === 0 &&
    digest.goalsReached.length === 0

  return (
    <section className="digest print-hide" aria-labelledby="digest-title">
      <h2 id="digest-title">
        <CalendarCheck size={20} aria-hidden="true" /> Підсумок тижня
      </h2>
      <p className="digest__lead">
        За {WEEK_DAYS} днів грали {digest.activeCount} з {students.length}, спроб: {digest.attempts}.
      </p>

      {quiet && <p>Нічого, що потребує уваги: усі грали, різких змін немає.</p>}

      <div className="digest__grid">
        {digest.goalsReached.length > 0 && (
          <div className="digest__block digest__block--good">
            <h3>Досягли цілі ІПР</h3>
            <ul>
              {digest.goalsReached.map(({ student, goal }) => (
                <li key={goal.id}>
                  <Name student={student} /> — {goalTitle(goal)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {digest.rises.length > 0 && (
          <div className="digest__block digest__block--good">
            <h3>Помітно краще</h3>
            <ul>
              {digest.rises.map((change) => (
                <li key={change.student.id}>
                  <Name student={change.student} /> — {GAME_TITLES[change.gameId] ?? change.gameId}:{' '}
                  {change.before} → {change.now}
                </li>
              ))}
            </ul>
          </div>
        )}

        {digest.drops.length > 0 && (
          <div className="digest__block digest__block--watch">
            <h3>Бал просів</h3>
            <ul>
              {digest.drops.map((change) => (
                <li key={change.student.id}>
                  <Name student={change.student} /> — {GAME_TITLES[change.gameId] ?? change.gameId}:{' '}
                  {change.before} → {change.now}
                </li>
              ))}
            </ul>
            <p className="digest__hint">
              Тиждень проти чотирьох попередніх, у тій самій грі, різниця від {NOTABLE_CHANGE} балів.
              Втома, хвороба чи новий рівень — варто запитати, а не робити висновків.
            </p>
          </div>
        )}

        {digest.inactive.length > 0 && (
          <div className="digest__block">
            <h3>Не грали {WEEK_DAYS} днів</h3>
            <ul>
              {digest.inactive.map(({ student, lastPlayed }) => (
                <li key={student.id}>
                  <Name student={student} /> —{' '}
                  {lastPlayed ? `востаннє ${formatDate(lastPlayed)}` : 'ще жодного разу'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default WeeklyDigest
