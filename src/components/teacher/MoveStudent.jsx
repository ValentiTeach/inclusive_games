import { useEffect, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { getMyGroups } from '../../lib/groups'
import { TEAM_ERROR, TEAM_ERROR_TEXT, moveStudent } from '../../lib/team'
import './MoveStudent.css'

/**
 * Перевести дитину в іншу групу: наступний клас, інший фахівець.
 *
 * Своя група — одним натиском; чужа — за її кодом, тим самим, що дитина
 * ввела б сама. Історія не губиться: спроби, адаптації, батьки й згода
 * прив'язані до дитини, а не до групи.
 */
function MoveStudent({ student, groupId, userId, onMoved, onClose }) {
  const [groups, setGroups] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMyGroups()
      .then((rows) => {
        if (!cancelled) {
          setGroups(rows.filter((group) => group.id !== groupId && group.teacher_id === userId))
        }
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [groupId, userId])

  async function move(targetCode, targetName) {
    const confirmed = window.confirm(
      `Перевести ${student.displayName} в групу ${targetName}? Дитина зникне з цієї групи, а її результати переїдуть разом із нею.`,
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      await moveStudent(student.id, targetCode)
      onMoved(student, targetName)
    } catch (caught) {
      setError(TEAM_ERROR_TEXT[caught?.reason] ?? TEAM_ERROR_TEXT[TEAM_ERROR.UNKNOWN])
      setBusy(false)
    }
  }

  return (
    <div className="move-student print-hide" role="dialog" aria-labelledby="move-title">
      <h2 id="move-title">
        <ArrowRightLeft size={18} aria-hidden="true" /> Перевести {student.displayName}
      </h2>

      {groups === null ? (
        <p>Завантаження…</p>
      ) : groups.length > 0 ? (
        <div className="move-student__own">
          <p className="move-student__label">У свою групу:</p>
          <div className="move-student__options">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="move-student__option"
                disabled={busy}
                onClick={() => move(group.join_code, `«${group.name}»`)}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className="move-student__code"
        onSubmit={(event) => {
          event.preventDefault()
          move(code, `з кодом ${code.trim().toUpperCase()}`)
        }}
      >
        <label className="move-student__label" htmlFor="move-code">
          {groups?.length ? 'Або в групу колеги — її код' : 'Код групи, куди перевести'}
        </label>
        <div className="move-student__row">
          <input
            id="move-code"
            className="move-student__input"
            value={code}
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button type="submit" className="move-student__submit" disabled={busy || code.trim() === ''}>
            Перевести
          </button>
        </div>
      </form>

      {error && <p className="move-student__error">{error}</p>}

      <button type="button" className="move-student__close" onClick={onClose}>
        Скасувати
      </button>
    </div>
  )
}

export default MoveStudent
