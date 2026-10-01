import { useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring, valueAt } from './numberLine.config'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './NumberLinePlayArea.css'

const FEEDBACK_MS = 1400

function NumberLinePlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [marker, setMarker] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const lineRef = useRef(null)
  const resultsRef = useRef([])

  function answer(value) {
    if (feedback) return
    const result = checkAnswer(level, trial, value)
    resultsRef.current.push(result)
    setMarker(value)
    setFeedback(result)
    if (result.correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setMarker(null)
      setTrialIndex(next)
      setTrial(generateTrial(level, trial))
    }, FEEDBACK_MS)
  }

  function handlePointer(event) {
    const rect = lineRef.current.getBoundingClientRect()
    if (!rect.width) return
    answer(valueAt(level, (event.clientX - rect.left) / rect.width))
  }

  /*
   * З клавіатури позначка стартує з середини: це нейтральна точка, яка нічого
   * не підказує. Крок — одна одиниця, а на 0–100 — п'ять, інакше до краю
   * довелося б тиснути п'ятдесят разів.
   */
  const keyStep = level.max > 20 ? 5 : 1
  useGameKeys({
    enabled: !feedback,
    onArrow: (dir) => {
      const delta = dir === 'right' || dir === 'up' ? keyStep : -keyStep
      setMarker((value) => Math.min(level.max, Math.max(0, (value ?? level.max / 2) + delta)))
    },
    onEnter: () => answer(marker ?? level.max / 2),
  })

  const ticks = Array.from({ length: level.max / level.tick + 1 }, (_, i) => i * level.tick)
  const percent = (value) => `${(value / level.max) * 100}%`

  return (
    <div className="number-line">
      <p className="number-line__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="number-line__prompt">Де стоїть число</p>
      <p className="number-line__target">{trial.target}</p>

      <div className="number-line__area">
        <div
          ref={lineRef}
          className="number-line__line"
          onPointerDown={handlePointer}
          role="slider"
          tabIndex={0}
          aria-label={`Пряма від 0 до ${level.max}`}
          aria-valuemin={0}
          aria-valuemax={level.max}
          aria-valuenow={marker ?? level.max / 2}
        >
          {ticks.map((value) => (
            <span key={value} className="number-line__tick" style={{ left: percent(value) }} />
          ))}
          {marker !== null && (
            <span
              className={[
                'number-line__marker',
                feedback ? (feedback.correct ? 'is-right' : 'is-wrong') : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: percent(marker) }}
            />
          )}
          {/* Після відповіді показуємо, де число насправді: без цього дитина
              знала б лише «не влучив», а не «куди саме». */}
          {feedback && (
            <span className="number-line__truth" style={{ left: percent(trial.target) }}>
              {trial.target}
            </span>
          )}
        </div>
        <div className="number-line__ends" aria-hidden="true">
          <span>0</span>
          <span>{level.max}</span>
        </div>
      </div>

      <p className="number-line__status" aria-live="polite">
        {feedback
          ? feedback.correct
            ? 'Влучно!'
            : `Число ${trial.target} — ось тут. Твоя позначка — ${marker}.`
          : ''}
      </p>
    </div>
  )
}

export default NumberLinePlayArea
