import { useCallback, useEffect, useState } from 'react'
import { Copy, Ban, UserRoundMinus, RefreshCw } from 'lucide-react'
import {
  createParentInvite,
  listParentAccess,
  revokeParentInvite,
  revokeParentAccess,
  inviteState,
  INVITE_STATE_TEXT,
  PARENT_ERROR_TEXT,
} from '../../lib/parents'
import './ParentAccess.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

/**
 * Хто має доступ до однієї дитини — і чим його відібрати.
 *
 * Раніше код показувався один раз після натискання і зникав назавжди: учитель
 * не бачив, що він роздав, і не міг скасувати нічого. Код диктують уголос і
 * переписують на папір, тож загублений аркуш означав безстроковий доступ до
 * дитини для того, хто його підняв.
 */
function ParentAccess({ student, onClose }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [fresh, setFresh] = useState(null)

  const reload = useCallback(async () => {
    const data = await listParentAccess(student.id)
    setRows(data)
  }, [student.id])

  useEffect(() => {
    let cancelled = false
    listParentAccess(student.id)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((error) => {
        if (!cancelled) {
          setRows([])
          setErrorText(PARENT_ERROR_TEXT[error?.reason] ?? PARENT_ERROR_TEXT.unknown)
        }
      })
    return () => {
      cancelled = true
    }
  }, [student.id])

  async function run(action) {
    setBusy(true)
    setErrorText(null)
    try {
      await action()
      await reload()
    } catch (error) {
      setErrorText(PARENT_ERROR_TEXT[error?.reason] ?? PARENT_ERROR_TEXT.unknown)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate() {
    await run(async () => {
      const code = await createParentInvite(student.id)
      setFresh(code)
    })
  }

  return (
    <div className="parent-access">
      <div className="parent-access__head">
        <h3>Доступ батьків: {student.displayName}</h3>
        <button type="button" className="parent-access__close" onClick={onClose}>
          Закрити
        </button>
      </div>

      <p className="parent-access__note">
        Код виписується на цю дитину й діє 7 днів. Дорослий уводить його на сторінці
        «Моя дитина». Код спрацьовує один раз.
      </p>

      {errorText && <p className="parent-access__error">{errorText}</p>}

      <button
        type="button"
        className="parent-access__create"
        disabled={busy}
        onClick={handleCreate}
      >
        <RefreshCw size={16} aria-hidden="true" />
        Виписати новий код
      </button>

      {rows === null && <p>Завантаження…</p>}

      {rows !== null && rows.length === 0 && (
        <p className="parent-access__empty">Жодного коду ще не виписано.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <ul className="parent-access__list">
          {rows.map((row) => {
            const state = inviteState(row)
            return (
              <li
                key={row.code}
                className={
                  row.code === fresh
                    ? 'parent-access__row parent-access__row--fresh'
                    : 'parent-access__row'
                }
              >
                <code className="parent-access__code">{row.code}</code>

                <span className={`parent-access__state parent-access__state--${state}`}>
                  {INVITE_STATE_TEXT[state]}
                </span>

                <span className="parent-access__when">
                  {state === 'used'
                    ? `${row.parent_label} · ${formatDate(row.used_at)}`
                    : `до ${formatDate(row.expires_at)}`}
                </span>

                <span className="parent-access__actions">
                  {state === 'active' && (
                    <>
                      <button
                        type="button"
                        className="parent-access__icon"
                        aria-label={`Скопіювати код ${row.code}`}
                        onClick={() => navigator.clipboard?.writeText(row.code)}
                      >
                        <Copy size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="parent-access__icon parent-access__icon--danger"
                        aria-label={`Скасувати код ${row.code}`}
                        disabled={busy}
                        onClick={() => run(() => revokeParentInvite(row.code))}
                      >
                        <Ban size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}

                  {/*
                    Скасувати використаний код нічим не допоможе: доступ живе у
                    зв'язку, а не в коді. Тому тут інша дія — відібрати доступ у
                    того, хто вже ввійшов.
                  */}
                  {state === 'used' && row.parent_id && (
                    <button
                      type="button"
                      className="parent-access__icon parent-access__icon--danger"
                      aria-label={`Відібрати доступ у ${row.parent_label}`}
                      disabled={busy}
                      onClick={() => run(() => revokeParentAccess(row.parent_id, student.id))}
                    >
                      <UserRoundMinus size={16} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ParentAccess
