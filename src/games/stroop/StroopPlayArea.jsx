import { useEffect, useRef, useState } from 'react'
import { COLORS, generateTrial, checkAnswer, scoring } from './stroop.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import './StroopPlayArea.css'

function StroopPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial())
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)

  useEffect(() => {
    trialStartRef.current = now()
  }, [trial])

  function handleAnswer(colorId) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(trial, colorId)
    resultsRef.current.push({ correct, reactionTimeMs })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      setFeedback(null)
      const nextIndex = trialIndex + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setTrialIndex(nextIndex)
      setTrial(generateTrial())
    }, 220)
  }

  const progress = `${trialIndex + 1} / ${level.trialCount}`

  return (
    <div className="stroop">
      <p className="stroop__progress">{progress}</p>
      <div
        className={[
          'stroop__word',
          feedback === 'right' ? 'stroop__word--right' : '',
          feedback === 'wrong' ? 'stroop__word--wrong' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ color: trial.ink.hex }}
      >
        {trial.word.label}
      </div>
      <div className="stroop__options">
        {COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className="stroop__option"
            onClick={() => handleAnswer(color.id)}
            disabled={Boolean(feedback)}
          >
            <span className="stroop__swatch" style={{ background: color.hex }} />
            {color.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default StroopPlayArea
