import { useEffect, useState } from 'react'
import { Bug } from 'lucide-react'
import {
  ERROR_RETENTION_DAYS,
  ServiceLogUnavailableError,
  fetchRecentErrors,
  groupErrors,
  purgeOldErrors,
} from '../../lib/serviceLog'
import './ServiceLog.css'

const DAYS = 7
const RECENT = 50

const KIND_LABELS = {
  render: 'малювання',
  window: 'сторінка',
  promise: 'запит',
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Журнал падінь у браузерах.
 *
 * Досі його можна було прочитати лише в дашборді Supabase — тобто майже
 * ніхто не читав. Тут два погляди: згруповано за текстом (що болить найбільше
 * цього тижня) і останні 50 по черзі (що сталося щойно, після викладки).
 */
function ErrorLogPanel() {
  const [rows, setRows] = useState(null)
  const [view, setView] = useState('grouped')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchRecentErrors({ days: DAYS })
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не вдалося завантажити журнал помилок.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function purge() {
    const confirmed = window.confirm(
      `Видалити з журналу всі записи, старші за ${ERROR_RETENTION_DAYS} днів?`,
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      const count = await purgeOldErrors()
      setMessage(`Видалено старих записів: ${count}.`)
    } catch (caught) {
      setError(
        caught instanceof ServiceLogUnavailableError
          ? 'Очищення ще не ввімкнене на сервері: треба застосувати міграцію 20261013_logs_limits_account.sql.'
          : 'Не вдалося очистити журнал. Спробуй ще раз.',
      )
    } finally {
      setBusy(false)
    }
  }

  const groups = rows ? groupErrors(rows) : []

  return (
    <section className="service-log" aria-labelledby="error-log-title">
      <h2 id="error-log-title">
        <Bug size={20} aria-hidden="true" /> Журнал помилок
      </h2>
      <p>
        Падіння в браузерах дітей і дорослих за останні {DAYS} днів. Записи, старші за{' '}
        {ERROR_RETENTION_DAYS} днів, видаляються.
      </p>

      {error && <p className="service-log__error">{error}</p>}
      {message && (
        <p className="service-log__message" role="status">
          {message}
        </p>
      )}

      {rows === null && !error && <p>Завантаження…</p>}

      {rows !== null && rows.length === 0 && <p>За {DAYS} днів жодного падіння.</p>}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="service-log__views" role="group" aria-label="Як показати журнал">
            <button
              type="button"
              className="service-log__view"
              aria-pressed={view === 'grouped'}
              onClick={() => setView('grouped')}
            >
              Згруповано ({groups.length})
            </button>
            <button
              type="button"
              className="service-log__view"
              aria-pressed={view === 'recent'}
              onClick={() => setView('recent')}
            >
              Останні {Math.min(RECENT, rows.length)}
            </button>
          </div>

          {view === 'grouped' ? (
            <ul className="service-log__list">
              {groups.map((group) => (
                <li key={group.key} className="service-log__item">
                  <div className="service-log__head">
                    <span className="service-log__count" title={`Разів за ${DAYS} днів`}>
                      ×{group.count}
                    </span>
                    <span className="service-log__kind">{KIND_LABELS[group.kind] ?? group.kind}</span>
                    <code className="service-log__text">{group.message}</code>
                  </div>
                  <dl className="service-log__facts">
                    <div>
                      <dt>Останній раз</dt>
                      <dd>{formatTime(group.lastAt)}</dd>
                    </div>
                    <div>
                      <dt>Користувачів</dt>
                      <dd>{group.users || '—'}</dd>
                    </div>
                    <div>
                      <dt>Сторінки</dt>
                      <dd>{group.paths.slice(0, 5).join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Версії</dt>
                      <dd>{group.builds.join(', ') || '—'}</dd>
                    </div>
                  </dl>
                  {(group.latest.stack || group.latest.user_agent) && (
                    <details className="service-log__details">
                      <summary>Слід останнього випадку</summary>
                      {group.latest.user_agent && <p>{group.latest.user_agent}</p>}
                      {group.latest.stack && <pre>{group.latest.stack}</pre>}
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="service-log__table-wrap">
              <table className="service-log__table">
                <thead>
                  <tr>
                    <th>Коли</th>
                    <th>Вид</th>
                    <th>Помилка</th>
                    <th>Сторінка</th>
                    <th>Версія</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, RECENT).map((row) => (
                    <tr key={row.id}>
                      <td data-label="Коли">{formatTime(row.occurred_at)}</td>
                      <td data-label="Вид">{KIND_LABELS[row.kind] ?? row.kind}</td>
                      <td data-label="Помилка">
                        <code className="service-log__text">{row.message}</code>
                      </td>
                      <td data-label="Сторінка">{row.path ?? '—'}</td>
                      <td data-label="Версія">{row.build ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <button type="button" className="service-log__button" onClick={purge} disabled={busy}>
        Видалити записи, старші за {ERROR_RETENTION_DAYS} днів
      </button>
    </section>
  )
}

export default ErrorLogPanel
