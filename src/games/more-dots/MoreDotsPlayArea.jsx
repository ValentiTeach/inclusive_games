import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { checkAnswer, generateTrial, scatter, scoring } from './moreDots.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './MoreDotsPlayArea.css'

const FEEDBACK_MS = 700

function Cloud({ dots, hidden }) {
  return (
    <svg className="more-dots__cloud" viewBox="0 0 100 100" aria-hidden="true">
      {!hidden && dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} />)}
    </svg>
  )
}

function MoreDotsPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [visible, setVisible] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  const clouds = useMemo(() => ({ left: scatter(trial.left), right: scatter(trial.right) }), [trial])

  useEffect(() => {
    shownAtRef.current = now()
    const timer = setTimeout(() => setVisible(false), level.showMs)
    return () => clearTimeout(timer)
  }, [trial, level.showMs])

  function handleAnswer(side) {
    if (feedback) return
    const { correct } = checkAnswer(trial, side)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback({ correct, side })
    setVisible(true)
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setVisible(true)
      setTrialIndex(next)
      setTrial(generateTrial(level))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    onArrow: (dir) => {
      if (dir === 'left' || dir === 'right') handleAnswer(dir)
    },
  })

  return (
    <div className="more-dots">
      <p className="more-dots__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="more-dots__prompt">Де більше крапок?</p>

      <div className="more-dots__sides">
        {['left', 'right'].map((side) => (
          <button
            key={side}
            type="button"
            className={[
              'more-dots__side',
              feedback && side === trial.moreOn ? 'is-answer' : '',
              feedback && !feedback.correct && side === feedback.side ? 'is-wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(side)}
            aria-disabled={Boolean(feedback)}
            aria-label={side === 'left' ? 'Ліворуч більше' : 'Праворуч більше'}
          >
            <Cloud dots={clouds[side]} hidden={!visible} />
            {side === 'left' ? <ArrowLeft size={26} aria-hidden="true" /> : <ArrowRight size={26} aria-hidden="true" />}
            {feedback && <span className="more-dots__count">{trial[side]}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MoreDotsPlayArea
