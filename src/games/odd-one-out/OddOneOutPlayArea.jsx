import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring } from './oddOneOut.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import OptionKey from '../engine/OptionKey'
import { useGameKeys } from '../engine/useGameKeys'
import './OddOneOutPlayArea.css'

const FEEDBACK_MS = 600

function OddOneOutPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const startedAtRef = useRef(null)

  useEffect(() => {
    startedAtRef.current = now()
  }, [trial])

  function handleAnswer(itemId) {
    if (feedback) return

    const { correct } = checkAnswer(trial, itemId)
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
    optionCount: trial.items.length,
    onOption: (index) => handleAnswer(trial.items[index].id),
  })

  return (
    <div className="odd">
      <p className="odd__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="odd__prompt">Яка фігура зайва?</p>

      <div className="odd__items">
        {trial.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={[
              'odd__item',
              feedback && item.id === trial.oddId ? 'is-answer' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(item.id)}
            aria-disabled={Boolean(feedback)}
          >
            <OptionKey n={index + 1} />
            <ShapeIcon shape={item.shape} color={item.color} size={item.size} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default OddOneOutPlayArea
