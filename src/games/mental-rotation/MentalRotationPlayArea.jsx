import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './mentalRotation.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import './MentalRotationPlayArea.css'

function RotatingShape({ angle = 0, mirrored = false }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="mental-rotation__svg"
      style={{ transform: `rotate(${angle}deg) scaleX(${mirrored ? -1 : 1})` }}
    >
      <polygon points="15,15 85,15 85,40 55,40 55,85 30,85 30,40 15,40" />
    </svg>
  )
}

function MentalRotationPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)

  useEffect(() => {
    trialStartRef.current = now()
  }, [trial])

  function handleAnswer(response) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(trial, response)
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
      setTrial(generateTrial(level))
    }, 500)
  }

  return (
    <div className="mental-rotation">
      <p className="mental-rotation__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="mental-rotation__pair">
        <div className="mental-rotation__shape">
          <RotatingShape angle={0} mirrored={false} />
        </div>
        <div className="mental-rotation__shape">
          <RotatingShape angle={trial.angle} mirrored={trial.mirrored} />
        </div>
      </div>
      <div className="mental-rotation__options">
        <button
          type="button"
          className="mental-rotation__option"
          onClick={() => handleAnswer('same')}
          disabled={Boolean(feedback)}
        >
          Однакова
        </button>
        <button
          type="button"
          className="mental-rotation__option"
          onClick={() => handleAnswer('mirrored')}
          disabled={Boolean(feedback)}
        >
          Дзеркальна
        </button>
      </div>
    </div>
  )
}

export default MentalRotationPlayArea
