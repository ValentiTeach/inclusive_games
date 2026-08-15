import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './subitizing.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import './SubitizingPlayArea.css'

function SubitizingPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [phase, setPhase] = useState('flash')
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const answerShownAtRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      answerShownAtRef.current = now()
      setPhase('answer')
    }, level.flashMs)
    return () => clearTimeout(timer)
  }, [trial, level.flashMs])

  function handleAnswer(value) {
    if (feedback || phase !== 'answer') return

    const reactionTimeMs = Math.round(now() - answerShownAtRef.current)
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
      setPhase('flash')
    }, 450)
  }

  return (
    <div className="subitizing">
      <p className="subitizing__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="subitizing__stage">
        {phase === 'flash' &&
          trial.positions.map((pos, index) => (
            <span
              key={index}
              className="subitizing__dot"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            />
          ))}
        {phase === 'answer' && <p className="subitizing__prompt">Скільки було крапок?</p>}
      </div>
      <div className="subitizing__options">
        {trial.options.map((option) => (
          <button
            key={option}
            type="button"
            className="subitizing__option"
            onClick={() => handleAnswer(option)}
            disabled={phase !== 'answer' || Boolean(feedback)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SubitizingPlayArea
