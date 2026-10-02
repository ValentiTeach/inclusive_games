import { useState } from 'react'
import {
  ADAPTATIONS,
  isActive,
  normalizeAdaptations,
  saveStudentAdaptations,
} from '../../lib/adaptations'
import './Specialist.css'

/**
 * Профіль адаптацій дитини — форма фахівця.
 *
 * Колонка «для кого» — підказка тут, у формі, і нікуди не зберігається: у
 * базу йдуть лише перемикачі. Тому й форма не питає діагнозу.
 */
function AdaptationsEditor({ student, initial, onSaved }) {
  const [draft, setDraft] = useState(() => normalizeAdaptations(initial))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  function toggle(item, on) {
    setMessage(null)
    if (item.kind) setDraft((value) => ({ ...value, [item.id]: on ? item.range.default : 0 }))
    else setDraft((value) => ({ ...value, [item.id]: on }))
  }

  function setAmount(item, amount) {
    setMessage(null)
    setDraft((value) => ({ ...value, [item.id]: Number(amount) }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const saved = await saveStudentAdaptations(student.id, draft)
      setDraft(saved)
      onSaved?.(saved)
      setMessage(
        'Збережено. Профіль діятиме на всіх пристроях дитини з наступного входу чи оновлення сторінки.',
      )
    } catch {
      setMessage(
        'Не вдалося зберегти. Можливо, міграцію 20261002_specialist_tools.sql ще не застосовано.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="adaptations-form" onSubmit={handleSave}>
      <p className="vault__note">
        Окремо від налаштувань, які дитина змінює сама: це діє завжди, на всіх її пристроях. Діагноз
        не зберігається — лише самі перемикачі.
      </p>
      {ADAPTATIONS.map((item) => {
        const on = isActive(draft, item.id)
        const inputId = `adapt-${item.id}`
        return (
          <div key={item.id} className="adaptations-form__row">
            <input
              id={inputId}
              type="checkbox"
              checked={on}
              onChange={(event) => toggle(item, event.target.checked)}
            />
            <label htmlFor={inputId} className="adaptations-form__label">
              {item.label}
              <span className="specialist-muted"> — для: {item.forWhom}</span>
            </label>
            <p className="adaptations-form__detail">{item.detail}</p>
            {item.kind && on && (
              <div className="adaptations-form__value">
                <input
                  type="range"
                  min={item.range.min}
                  max={item.range.max}
                  step={item.range.step}
                  value={draft[item.id]}
                  aria-label={`${item.label}: значення`}
                  onChange={(event) => setAmount(item, event.target.value)}
                />
                <output>
                  {item.kind === 'ms' ? `${draft[item.id]} мс` : `до ${draft[item.id]} проб`}
                </output>
              </div>
            )}
          </div>
        )
      })}
      <div className="vault__row" style={{ marginTop: 'var(--space-4)' }}>
        <button type="submit" className="specialist-button" disabled={busy}>
          {busy ? 'Зберігаємо…' : 'Зберегти профіль'}
        </button>
      </div>
      {message && (
        <p className="vault__note" role="status">
          {message}
        </p>
      )}
    </form>
  )
}

export default AdaptationsEditor
