import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './matrices.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import './MatricesPlayArea.css'

function MatricesPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)

  useEffect(() => {
    trialStartRef.current = now()
  }, [trial])

  function handleAnswer(optionId) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(trial, optionId)
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
    <div className="matrices">
      <p className="matrices__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="matrices__grid">
        {trial.grid.map((cell) => {
          const isMissing = cell.r === 2 && cell.c === 2
          return (
            <div key={`${cell.r}-${cell.c}`} className="matrices__cell">
              {isMissing ? (
                <span className="matrices__question">?</span>
              ) : (
                <ShapeIcon shape={cell.shape} color={cell.color} size={cell.size} />
              )}
            </div>
          )
        })}
      </div>
      <div className="matrices__options">
        {trial.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={[
              'matrices__option',
              feedback && option.id === trial.correctId ? 'is-correct' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(option.id)}
            disabled={Boolean(feedback)}
          >
            <ShapeIcon shape={option.shape} color={option.color} size={option.size} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default MatricesPlayArea
