import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './targetSearch.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import './TargetSearchPlayArea.css'

function TargetSearchPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)

  useEffect(() => {
    trialStartRef.current = now()
  }, [trial])

  function handleItemClick(item) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(item)
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
    <div className="target-search">
      <p className="target-search__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="target-search__target">
        <span>Знайди:</span>
        <ShapeIcon shape={trial.target.shape} color={trial.target.color} size={36} />
      </div>
      <div className="target-search__scene">
        {trial.items.map((item) => (
          <button
            key={item.uid}
            type="button"
            className="target-search__item"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onClick={() => handleItemClick(item)}
            disabled={Boolean(feedback)}
            aria-label="Фігура"
          >
            <ShapeIcon shape={item.shape} color={item.color} size={26} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default TargetSearchPlayArea
