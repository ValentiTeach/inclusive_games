import { MOODS } from '../../lib/diary'

const MOUTHS = {
  good: 'M14 27 Q24 36 34 27',
  okay: 'M15 30 L33 30',
  sad: 'M14 33 Q24 24 34 33',
}

function Face({ mood }) {
  return (
    <svg viewBox="0 0 48 48" width={56} height={56} aria-hidden="true" focusable="false">
      <circle cx={24} cy={24} r={21} className={`mood-face mood-face--${mood}`} />
      <circle cx={17} cy={19} r={2.6} className="mood-face__ink" />
      <circle cx={31} cy={19} r={2.6} className="mood-face__ink" />
      <path d={MOUTHS[mood]} fill="none" strokeWidth={3} strokeLinecap="round" className="mood-face__line" />
    </svg>
  )
}

/** Три смайлики — більше дитині не потрібно, щоб сказати, як вона. */
function MoodPicker({ value, onChange, labelledBy }) {
  return (
    <div className="mood-picker" role="group" aria-labelledby={labelledBy}>
      {MOODS.map((mood) => (
        <button
          key={mood.id}
          type="button"
          className={value === mood.id ? 'mood-picker__option is-chosen' : 'mood-picker__option'}
          aria-pressed={value === mood.id}
          onClick={() => onChange(mood.id)}
        >
          <Face mood={mood.id} />
          <span>{mood.label}</span>
        </button>
      ))}
    </div>
  )
}

export default MoodPicker
