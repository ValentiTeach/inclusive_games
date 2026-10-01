import { useEffect, useRef, useState } from 'react'
import { checkAnswer, correctOrder, generateTrial, scoring } from './seriation.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import TapOrder from '../engine/TapOrder'
import { PICTURES } from '../engine/pictures'
import './SeriationPlayArea.css'

const FEEDBACK_MS = 1300

function Dots({ count, color }) {
  return (
    <span className="seriation__dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="seriation__dot" style={{ background: color }} />
      ))}
    </span>
  )
}

function renderItem(item, kind) {
  if (kind === 'time') {
    const Picture = PICTURES[item.icon]
    return (
      <>
        <Picture size={40} aria-hidden="true" />
        {item.label}
      </>
    )
  }
  if (kind === 'count') return <Dots count={item.value} color={item.color} />
  return (
    <span
      className="seriation__circle"
      style={{ width: item.value * 0.8, height: item.value * 0.8, background: item.color }}
      aria-hidden="true"
    />
  )
}

function SeriationPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [order, setOrder] = useState([])
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleComplete(finalOrder) {
    const { correct } = checkAnswer(trial, finalOrder)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    const expected = correctOrder(trial)
    setFeedback(
      Object.fromEntries(finalOrder.map((id, index) => [id, expected[index] === id ? 'right' : 'wrong'])),
    )
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setOrder([])
      setTrialIndex(next)
      setTrial(generateTrial(level, trial))
    }, FEEDBACK_MS)
  }

  return (
    <div className="seriation">
      <p className="seriation__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="seriation__prompt">{trial.prompt}</p>
      <TapOrder
        items={trial.items}
        order={order}
        onChange={setOrder}
        onComplete={handleComplete}
        disabled={Boolean(feedback)}
        feedback={feedback}
        renderItem={(item) => renderItem(item, trial.kind)}
      />
    </div>
  )
}

export default SeriationPlayArea
