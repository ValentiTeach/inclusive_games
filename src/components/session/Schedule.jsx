import { Check, Gamepad2, MessageCircleHeart, PersonStanding, Smile, Wind } from 'lucide-react'
import { stepShortTitle } from '../../data/sessionTemplates'

const ICONS = {
  greeting: Smile,
  breathing: Wind,
  game: Gamepad2,
  movement: PersonStanding,
  reflection: MessageCircleHeart,
}

/**
 * Візуальний розклад заняття: усі кроки картками, пройдене позначене, поточне
 * виділене, і над ними — «спочатку — потім».
 *
 * Для дитини з РАС передбачуваність критична: вона має бачити, скільки ще
 * лишилося і що буде далі, ще до того, як воно почнеться. Розклад не
 * змінюється під час заняття — пропущений крок лишається на своєму місці,
 * лише позначений.
 */
function Schedule({ steps, current, marks = [] }) {
  const byIndex = new Map(marks.map((mark) => [mark.i, mark]))
  const now = steps[current]
  const next = steps[current + 1]

  return (
    <div className="schedule">
      {now && (
        <p className="schedule__first-then">
          <span className="schedule__label">Спочатку:</span> <strong>{stepShortTitle(now)}</strong>
          {next && (
            <>
              {' → '}
              <span className="schedule__label">потім:</span> <strong>{stepShortTitle(next)}</strong>
            </>
          )}
        </p>
      )}
      <ol className="schedule__cards" aria-label="Кроки заняття">
        {steps.map((step, index) => {
          const Icon = ICONS[step.kind] ?? Gamepad2
          const mark = byIndex.get(index)
          const state = mark ? (mark.skipped ? 'skipped' : 'done') : index === current ? 'current' : 'next'
          const stateText = {
            done: 'пройдено',
            skipped: 'пропущено',
            current: 'зараз',
            next: 'далі',
          }[state]
          return (
            <li
              key={index}
              className={`schedule__card is-${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="schedule__icon" aria-hidden="true">
                {state === 'done' ? <Check size={20} /> : <Icon size={20} />}
              </span>
              <span className="schedule__title">{stepShortTitle(step)}</span>
              <span className="visually-hidden">, {stateText}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default Schedule
