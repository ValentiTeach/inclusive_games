import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring } from './continueRow.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import OptionKey from '../engine/OptionKey'
import { useGameKeys } from '../engine/useGameKeys'
import './ContinueRowPlayArea.css'

const FEEDBACK_MS = 600

function ContinueRowPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const startedAtRef = useRef(null)

  useEffect(() => {
    startedAtRef.current = now()
  }, [trial])

  function handleAnswer(optionId) {
    if (feedback) return

    const { correct } = checkAnswer(trial, optionId)
    resultsRef.current.push({
      correct,
      reactionTimeMs: Math.round(now() - startedAtRef.current),
    })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const nextIndex = trialIndex + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setFeedback(null)
      setTrialIndex(nextIndex)
      setTrial(generateTrial(level))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: trial.options.length,
    onOption: (index) => handleAnswer(trial.options[index].id),
  })

  return (
    <div className="row-game">
      <p className="row-game__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <div className="row-game__sequence">
        {trial.sequence.map((item, index) => (
          <span key={index} className="row-game__cell">
            <ShapeIcon shape={item.shape} color={item.color} size={item.size} />
          </span>
        ))}
        <span className="row-game__cell row-game__cell--next">?</span>
      </div>

      <p className="row-game__prompt">Що буде далі?</p>

      <div className="row-game__options">
        {trial.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={[
              'row-game__option',
              feedback && option.id === trial.correctId ? 'is-answer' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(option.id)}
            aria-disabled={Boolean(feedback)}
          >
            <OptionKey n={index + 1} />
            <ShapeIcon shape={option.shape} color={option.color} size={option.size} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default ContinueRowPlayArea
