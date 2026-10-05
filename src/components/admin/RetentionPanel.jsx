import { useState } from 'react'
import { Hourglass, Trash2 } from 'lucide-react'
import {
  RETENTION_MONTHS,
  RetentionUnavailableError,
  listInactiveStudents,
  moderatorDeleteStudent,
  purgeInactiveStudents,
} from '../../lib/retention'
import './RetentionPanel.css'

const UNAVAILABLE =
  'Видалення за строком ще не ввімкнене на сервері: треба застосувати міграцію 20261005_data_retention.sql.'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Строк зберігання: учні без активності понад 12 місяців — і їх видалення.
 *
 * Спершу список, потім кнопка: модератор має побачити, кого саме зачепить
 * очищення, перш ніж воно станеться. Тут же — видалення одного учня, зокрема
 * вже прибраного з групи: учитель такого більше не бачить, і досі видалити
 * його можна було лише SQL-запитом у панелі бази.
 */
function RetentionPanel() {
  const [students, setStudents] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  function fail(caught, fallback) {
    setError(caught instanceof RetentionUnavailableError ? UNAVAILABLE : fallback)
  }

  async function load() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setStudents(await listInactiveStudents())
    } catch (caught) {
      fail(caught, 'Не вдалося завантажити список. Спробуй ще раз.')
    } finally {
      setBusy(false)
    }
  }

  async function removeOne(student) {
    const confirmed = window.confirm(
      `Видалити «${student.displayName}» назавжди? Зникнуть усі результати, заняття, щоденник і обліковий запис. Скасувати це неможливо.`,
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      await moderatorDeleteStudent(student.id)
      setStudents((current) => current.filter((entry) => entry.id !== student.id))
      setMessage(`«${student.displayName}» видалено.`)
    } catch (caught) {
      fail(caught, 'Не вдалося видалити учня. Спробуй ще раз.')
    } finally {
      setBusy(false)
    }
  }

  async function removeAll() {
    const confirmed = window.confirm(
      `Видалити назавжди всіх учнів без активності понад ${RETENTION_MONTHS} місяців (${students.length})? Скасувати це неможливо.`,
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      const count = await purgeInactiveStudents()
      setStudents([])
      setMessage(`Видалено учнів: ${count}.`)
    } catch (caught) {
      fail(caught, 'Не вдалося видалити. Спробуй ще раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="retention" aria-labelledby="retention-title">
      <h2 id="retention-title">
        <Hourglass size={20} aria-hidden="true" /> Строк зберігання
      </h2>
      <p>
        Дані учня, який не грав і не проходив занять понад {RETENTION_MONTHS} місяців, видаляються —
        так обіцяє сторінка «Дані та приватність». Сюди потрапляють і діти, яких уже прибрали з групи:
        учитель їх більше не бачить і видалити не може.
      </p>

      {error && <p className="retention__error">{error}</p>}
      {message && (
        <p className="retention__message" role="status">
          {message}
        </p>
      )}

      {students === null ? (
        <button type="button" className="retention__button" onClick={load} disabled={busy}>
          {busy ? 'Шукаю…' : `Знайти учнів без активності понад ${RETENTION_MONTHS} місяців`}
        </button>
      ) : students.length === 0 ? (
        <p>Нікого: усі учні були активні за останні {RETENTION_MONTHS} місяців.</p>
      ) : (
        <>
          <div className="retention__table-wrap">
            <table className="retention__table">
              <thead>
                <tr>
                  <th>Учень</th>
                  <th>Група</th>
                  <th>Остання активність</th>
                  <th aria-label="Дії" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Учень">{student.displayName}</td>
                    <td data-label="Група">{student.inGroup ? 'у групі' : 'прибраний з групи'}</td>
                    <td data-label="Остання активність">{formatDate(student.lastActivity)}</td>
                    <td>
                      <button
                        type="button"
                        className="retention__icon"
                        aria-label={`Видалити ${student.displayName} назавжди`}
                        disabled={busy}
                        onClick={() => removeOne(student)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="retention__button retention__button--danger"
            onClick={removeAll}
            disabled={busy}
          >
            Видалити всіх ({students.length})
          </button>
        </>
      )}
    </section>
  )
}

export default RetentionPanel
