import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Fish } from 'lucide-react'
import { checkAnswer, generateTrial, scoring } from './flanker.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './FlankerPlayArea.css'

const FEEDBACK_MS = 450
/* Порожня мить між зграйками: без неї нова зграйка зливалась би зі старою, і
   дитина не бачила б, що проба змінилась. */
const GAP_MS = 350

function FlankerPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [phase, setPhase] = useState('show')
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    if (phase === 'show') shownAtRef.current = now()
  }, [phase, trial])

  function handleAnswer(direction) {
    if (phase !== 'show') return
    const { correct } = checkAnswer(trial, direction)
    resultsRef.current.push({
      correct,
      congruent: trial.congruent,
      reactionTimeMs: Math.round(now() - shownAtRef.current),
    })
    setFeedback(correct ? 'right' : 'wrong')
    setPhase('feedback')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setPhase('gap')
      setTimeout(() => {
        setTrialIndex(next)
        setTrial(generateTrial(level))
        setPhase('show')
      }, GAP_MS)
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: phase === 'show',
    onArrow: (dir) => {
      if (dir === 'left' || dir === 'right') handleAnswer(dir)
    },
  })

  return (
    <div className="flanker">
      <p className="flanker__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <div className="flanker__water">
        {phase !== 'gap' && (
          <div
            className={['flanker__school', feedback ? `is-${feedback}` : ''].filter(Boolean).join(' ')}
            style={{ transform: `translateY(${trial.offset * 70}px)` }}
            role="img"
            aria-label={`Середня рибка пливе ${trial.target === 'left' ? 'вліво' : 'вправо'}`}
          >
            {trial.fish.map((direction, index) => (
              <span
                key={index}
                className={[
                  'flanker__fish',
                  `flanker__fish--${direction}`,
                  index === Math.floor(trial.fish.length / 2) ? 'is-target' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Fish size={44} strokeWidth={1.8} aria-hidden="true" />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flanker__answers">
        <button
          type="button"
          className="flanker__answer"
          onClick={() => handleAnswer('left')}
          aria-disabled={phase !== 'show'}
          aria-label="Вліво"
        >
          <ArrowLeft size={34} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flanker__answer"
          onClick={() => handleAnswer('right')}
          aria-disabled={phase !== 'show'}
          aria-label="Вправо"
        >
          <ArrowRight size={34} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default FlankerPlayArea
