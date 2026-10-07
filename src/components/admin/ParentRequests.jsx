import { useEffect, useState } from 'react'
import { Check, X, HeartHandshake } from 'lucide-react'
import {
  ParentApprovalUnavailableError,
  decideParentRequest,
  listParentRequests,
} from '../../lib/admin'
import { PARENT_ERROR_TEXT } from '../../lib/parents'
import { announceParentRequestsChanged } from '../../lib/usePendingParentRequests'
import RoleBadge from '../ui/RoleBadge'
import './ParentRequests.css'

const UNAVAILABLE =
  'Заявки батьків ще не ввімкнені на сервері: треба застосувати міграцію 20261006_parent_approval.sql.'

function describeFailure(caught, fallback) {
  if (caught instanceof ParentApprovalUnavailableError) return UNAVAILABLE
  return PARENT_ERROR_TEXT[caught?.reason] ?? fallback
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Черга заявок на доступ до дитини.
 *
 * Дорослий вводить код від учителя й нічого не отримує, доки модератор не
 * розгляне заявку. Тут видно все, за чим вирішують: пошту заявника, дитину,
 * клас, вчителя групи й того, хто виписав код. Якщо код виписав не вчитель цієї
 * групи — це теж привід зупинитись, тож «виписав» показується окремо від
 * «вчитель групи».
 */
function ParentRequests() {
  const [requests, setRequests] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listParentRequests()
      .then((data) => {
        if (!cancelled) setRequests(data)
      })
      .catch((caught) => {
        if (cancelled) return
        setRequests([])
        setError(describeFailure(caught, 'Не вдалося завантажити заявки. Спробуй оновити сторінку.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function decide(request, approve) {
    const who = request.parentEmail ?? request.parentName ?? 'цей користувач'
    const confirmed = window.confirm(
      approve
        ? `Відкрити «${who}» доступ до результатів «${request.studentName}»? Це підтвердження, що це його батько або опікун.`
        : `Відхилити заявку «${who}» на «${request.studentName}»? Код буде спалено — вчитель має виписати новий.`,
    )
    if (!confirmed) return

    setPendingId(request.id)
    setError(null)
    setMessage(null)
    try {
      await decideParentRequest(request.id, approve)
      setRequests((current) => current.filter((entry) => entry.id !== request.id))
      setMessage(
        approve
          ? `«${who}» тепер бачить результати «${request.studentName}».`
          : `Заявку «${who}» відхилено.`,
      )
      announceParentRequestsChanged()
    } catch (caught) {
      setError(describeFailure(caught, 'Не вдалося зберегти рішення. Спробуй ще раз.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="parent-requests" aria-labelledby="parent-requests-title">
      <h2 id="parent-requests-title">
        <HeartHandshake size={20} aria-hidden="true" /> Заявки батьків
        {requests?.length > 0 && <span className="parent-requests__count">{requests.length}</span>}
      </h2>
      <p>
        Дорослий уводить код від учителя й подає заявку. Доступ до результатів дитини він
        отримує лише після твого схвалення — переконайся, що пошта справді належить
        батькові чи опікуну.
      </p>

      {error && <p className="parent-requests__error">{error}</p>}
      {message && (
        <p className="parent-requests__message" role="status">
          {message}
        </p>
      )}

      {requests === null && <p>Завантаження…</p>}

      {requests !== null && requests.length === 0 && !error && <p>Нових заявок немає.</p>}

      {requests !== null && requests.length > 0 && (
        <ul className="parent-requests__list">
          {requests.map((request) => (
            <li key={request.id} className="parent-requests__item">
              <div className="parent-requests__who">
                <strong className="parent-requests__email">
                  {request.parentEmail ?? request.parentName ?? '—'}
                </strong>
                <RoleBadge role={request.parentRole} />
              </div>

              <dl className="parent-requests__facts">
                <div>
                  <dt>Дитина</dt>
                  <dd>{request.studentName}</dd>
                </div>
                <div>
                  <dt>Група</dt>
                  <dd>{request.groupName ?? 'прибрана з групи'}</dd>
                </div>
                <div>
                  <dt>Вчитель групи</dt>
                  <dd>{request.teacherName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Код виписав</dt>
                  <dd>{request.invitedByName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Подано</dt>
                  <dd>{formatDate(request.createdAt)}</dd>
                </div>
              </dl>

              {request.parentHasGroups && (
                <p className="parent-requests__note">
                  Заявник сам веде групи, тож роль «Вчитель» збережеться. Доступ до дитини він
                  отримає в будь-якому разі.
                </p>
              )}

              <div className="parent-requests__actions">
                <button
                  type="button"
                  className="parent-requests__button parent-requests__button--approve"
                  disabled={pendingId === request.id}
                  onClick={() => decide(request, true)}
                  aria-label={`Підтвердити: ${request.parentEmail ?? request.parentName} — батько ${request.studentName}`}
                >
                  <Check size={16} aria-hidden="true" /> Підтвердити
                </button>
                <button
                  type="button"
                  className="parent-requests__button parent-requests__button--reject"
                  disabled={pendingId === request.id}
                  onClick={() => decide(request, false)}
                  aria-label={`Відхилити заявку ${request.parentEmail ?? request.parentName} на ${request.studentName}`}
                >
                  <X size={16} aria-hidden="true" /> Відхилити
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ParentRequests
