import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { listAllUsers, setUserRole } from '../lib/admin'
import RoleBadge from '../components/ui/RoleBadge'
import './Admin.css'

const ROLE_OPTIONS = ['student', 'teacher', 'moderator']
const ROLE_LABELS = { student: 'Учень', teacher: 'Вчитель', moderator: 'Модератор' }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Admin() {
  const { user, profile, loading } = useAuth()
  const [users, setUsers] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const isModerator = profile?.role === 'moderator'

  useEffect(() => {
    if (!isModerator) return undefined

    let cancelled = false
    listAllUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Не вдалося завантажити список користувачів.')
      })
    return () => {
      cancelled = true
    }
  }, [isModerator])

  if (!isCloudConfigured) {
    return (
      <section className="admin">
        <h1>Адмін-панель</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="admin">
        <h1>Адмін-панель</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isModerator) {
    return (
      <section className="admin">
        <h1>Адмін-панель</h1>
        <p>Доступ лише для модераторів.</p>
      </section>
    )
  }

  async function handleRoleChange(targetUser, nextRole) {
    if (nextRole === targetUser.role) return

    const label = targetUser.email ?? targetUser.display_name ?? targetUser.id
    const confirmed = window.confirm(
      `Змінити роль користувача «${label}» на «${ROLE_LABELS[nextRole]}»?`,
    )
    if (!confirmed) return

    setPendingId(targetUser.id)
    setErrorMessage(null)

    try {
      await setUserRole(targetUser.id, nextRole)
      setUsers((prev) =>
        prev.map((entry) => (entry.id === targetUser.id ? { ...entry, role: nextRole } : entry)),
      )
    } catch {
      setErrorMessage('Не вдалося змінити роль. Спробуй ще раз.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="admin">
      <h1>Адмін-панель</h1>
      <p>Усі користувачі платформи. Тут можна призначати ролі.</p>

      {errorMessage && <p className="admin__error">{errorMessage}</p>}

      {users === null ? (
        <p>Завантаження…</p>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Користувач</th>
                <th>Тип входу</th>
                <th>Група</th>
                <th>Роль</th>
                <th>Зареєстрований</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.email ?? entry.display_name ?? '—'}</td>
                  <td>{entry.is_anonymous ? 'За кодом групи' : 'Поштою'}</td>
                  <td>{entry.group_name ?? '—'}</td>
                  <td>
                    <div className="admin__role-cell">
                      <RoleBadge role={entry.role} />
                      <select
                        className="admin__role-select"
                        value={entry.role}
                        disabled={pendingId === entry.id}
                        onChange={(event) => handleRoleChange(entry, event.target.value)}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>{formatDate(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default Admin
