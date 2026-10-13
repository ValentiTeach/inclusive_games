import { useEffect, useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import {
  FEEDBACK_KINDS,
  FEEDBACK_RETENTION_MONTHS,
  ServiceLogUnavailableError,
  deleteFeedback,
  listFeedback,
  setFeedbackResolved,
} from '../../lib/serviceLog'
import './ServiceLog.css'

const UNAVAILABLE =
  'Відгуків ще немає на сервері: треба застосувати міграцію 20261013_logs_limits_account.sql.'

function formatTime(iso) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Відгуки з форми «Повідомити про проблему / ідею».
 *
 * Нерозібрані зверху. «Розібрано» не видаляє: відгук лишається, щоб було видно
 * повтори, і зникає сам за строком. «Видалити» — для спаму.
 */
function FeedbackPanel({ moderatorId }) {
  const [rows, setRows] = useState(null)
  const [showResolved, setShowResolved] = useState(false)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    listFeedback()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(
          caught instanceof ServiceLogUnavailableError
            ? UNAVAILABLE
            : 'Не вдалося завантажити відгуки.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(row) {
    setBusyId(row.id)
    setError(null)
    try {
      const resolved = !row.resolved_at
      await setFeedbackResolved(row.id, resolved, moderatorId)
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? { ...entry, resolved_at: resolved ? new Date().toISOString() : null }
            : entry,
        ),
      )
    } catch {
      setError('Не вдалося змінити позначку. Спробуй ще раз.')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(row) {
    if (!window.confirm('Видалити цей відгук назавжди?')) return
    setBusyId(row.id)
    setError(null)
    try {
      await deleteFeedback(row.id)
      setRows((current) => current.filter((entry) => entry.id !== row.id))
    } catch {
      setError('Не вдалося видалити відгук. Спробуй ще раз.')
    } finally {
      setBusyId(null)
    }
  }

  const open = rows?.filter((row) => !row.resolved_at) ?? []
  const resolved = rows?.filter((row) => row.resolved_at) ?? []
  const visible = showResolved ? [...open, ...resolved] : open

  return (
    <section className="service-log" aria-labelledby="feedback-title">
      <h2 id="feedback-title">
        <MessageSquare size={20} aria-hidden="true" /> Відгуки
        {open.length > 0 && <span className="service-log__badge">{open.length}</span>}
      </h2>
      <p>
        Повідомлення з форми в підвалі сайту. Видаляються через {FEEDBACK_RETENTION_MONTHS}{' '}
        місяців.
      </p>

      {error && <p className="service-log__error">{error}</p>}
      {rows === null && !error && <p>Завантаження…</p>}
      {rows !== null && open.length === 0 && <p>Нерозібраних відгуків немає.</p>}

      {visible.length > 0 && (
        <ul className="service-log__list">
          {visible.map((row) => (
            <li
              key={row.id}
              className={`service-log__item${row.resolved_at ? ' service-log__item--done' : ''}`}
            >
              <div className="service-log__head">
                <span className="service-log__kind">{FEEDBACK_KINDS[row.kind] ?? row.kind}</span>
                <span className="service-log__when">{formatTime(row.created_at)}</span>
                {row.resolved_at && <span className="service-log__kind">розібрано</span>}
              </div>
              <p className="service-log__body">{row.message}</p>
              <dl className="service-log__facts">
                <div>
                  <dt>Контакт</dt>
                  <dd className="service-log__contact">{row.contact ?? '—'}</dd>
                </div>
                <div>
                  <dt>Сторінка</dt>
                  <dd>{row.path ?? '—'}</dd>
                </div>
                <div>
                  <dt>Хто</dt>
                  <dd>{row.user_id ? 'з акаунта' : 'гість'}</dd>
                </div>
              </dl>
              <div className="service-log__actions">
                <button
                  type="button"
                  className="service-log__button"
                  disabled={busyId === row.id}
                  onClick={() => toggle(row)}
                >
                  {row.resolved_at ? 'Повернути в роботу' : 'Розібрано'}
                </button>
                <button
                  type="button"
                  className="service-log__icon"
                  aria-label="Видалити відгук"
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <button
          type="button"
          className="service-log__button"
          onClick={() => setShowResolved((value) => !value)}
        >
          {showResolved ? 'Сховати розібрані' : `Показати розібрані (${resolved.length})`}
        </button>
      )}
    </section>
  )
}

export default FeedbackPanel
