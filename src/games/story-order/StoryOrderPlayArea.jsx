import { useEffect, useRef, useState } from 'react'
import { checkAnswer, correctOrder, generateTrial, scoring, storyText } from './storyOrder.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import TapOrder from '../engine/TapOrder'
import SpeakButton from '../engine/SpeakButton'
import { PICTURES } from '../engine/pictures'
import './StoryOrderPlayArea.css'

/* Історію треба встигнути прочитати чи почути, тож пауза довша, ніж в інших іграх. */
const FEEDBACK_MS = 3200

function StoryOrderPlayArea({ level, onFinish }) {
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

  const story = storyText(trial)

  return (
    <div className="story-order">
      <p className="story-order__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="story-order__prompt">Що було спочатку, а що потім?</p>

      <TapOrder
        items={trial.items}
        order={order}
        onChange={setOrder}
        onComplete={handleComplete}
        disabled={Boolean(feedback)}
        feedback={feedback}
        renderItem={(item) => {
          const Picture = PICTURES[item.icon]
          return (
            <>
              <Picture size={40} strokeWidth={1.6} aria-hidden="true" />
              <span className="story-order__caption">{item.label}</span>
            </>
          )
        }}
      />

      {/* Після відповіді — історія цілим реченням у правильному порядку: це
          місток до переказу, заради якого логопед і дає таке завдання. */}
      {feedback && (
        <div className="story-order__story" aria-live="polite">
          <p>{story}</p>
          <SpeakButton text={story} auto label="Послухати історію" />
        </div>
      )}
    </div>
  )
}

export default StoryOrderPlayArea
