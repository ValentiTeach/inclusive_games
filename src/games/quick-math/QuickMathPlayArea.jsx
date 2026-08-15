import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './quickMath.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import './QuickMathPlayArea.css'

function QuickMathPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)

  useEffect(() => {
    trialStartRef.current = now()
  }, [trial])

  function handleAnswer(value) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(trial, value)
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
    }, 450)
  }

  return (
    <div className="quick-math">
      <p className="quick-math__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="quick-math__expression">{trial.text}</div>
      <div className="quick-math__options">
        {trial.options.map((option) => (
          <button
            key={option}
            type="button"
            className={[
              'quick-math__option',
              feedback && option === trial.answer ? 'is-correct' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(option)}
            disabled={Boolean(feedback)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuickMathPlayArea
