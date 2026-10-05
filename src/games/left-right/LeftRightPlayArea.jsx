import { useEffect, useRef, useState } from 'react'
import { checkAnswer, explain, generateTrial, scoring } from './leftRight.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import { PICTURES } from '../engine/pictures'
import Kid from './Kid'
import './LeftRightPlayArea.css'

const FEEDBACK_MS = 700
/* Після помилки дитина має встигнути прочитати, чому. */
const WRONG_FEEDBACK_MS = 2200

const ANSWERS = ['left', 'right']

function Scene({ trial }) {
  const House = PICTURES.House
  const Object_ = PICTURES[trial.object.icon]
  const object = (
    <span className="left-right__object">
      <Object_ size={52} strokeWidth={1.6} aria-hidden="true" />
    </span>
  )
  return (
    <div className="left-right__scene" role="img" aria-label={`Будиночок і ${trial.object.word}`}>
      {trial.side === 'left' ? object : <span className="left-right__spacer" />}
      <span className="left-right__house">
        <House size={88} strokeWidth={1.5} aria-hidden="true" />
      </span>
      {trial.side === 'right' ? object : <span className="left-right__spacer" />}
    </div>
  )
}

function LeftRightPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const historyRef = useRef([trial])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleAnswer(response) {
    if (feedback) return
    const { correct } = checkAnswer(trial, response)
    resultsRef.current.push({
      correct,
      mode: trial.mode,
      reactionTimeMs: Math.round(now() - shownAtRef.current),
    })
    setFeedback({ correct, response })
    if (correct) playCorrect()
    else playWrong()

    setTimeout(
      () => {
        const next = trialIndex + 1
        if (next >= level.trialCount) {
          onFinish(scoring(resultsRef.current))
          return
        }
        const nextTrial = generateTrial(level, historyRef.current)
        historyRef.current.push(nextTrial)
        setFeedback(null)
        setTrialIndex(next)
        setTrial(nextTrial)
      },
      correct ? FEEDBACK_MS : WRONG_FEEDBACK_MS,
    )
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: ANSWERS.length,
    onOption: (index) => handleAnswer(ANSWERS[index]),
    onArrow: (direction) => {
      if (direction === 'left' || direction === 'right') handleAnswer(direction)
    },
  })

  const isScene = trial.mode === 'scene'
  const labels = isScene ? { left: 'Ліворуч', right: 'Праворуч' } : { left: 'У лівій', right: 'У правій' }

  return (
    <div className="left-right">
      <p className="left-right__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="left-right__prompt">
        {isScene
          ? `Де ${trial.object.word}: ліворуч чи праворуч від будиночка?`
          : 'У якій руці дитина тримає кульку?'}
      </p>

      <div
        className={[
          'left-right__stage',
          feedback ? (feedback.correct ? 'is-right' : 'is-wrong') : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isScene ? <Scene trial={trial} /> : <Kid view={trial.mode} side={trial.side} />}
      </div>

      <div className="left-right__answers">
        {ANSWERS.map((side, index) => (
          <button
            key={side}
            type="button"
            className={[
              'left-right__answer',
              feedback && side === trial.answer ? 'is-answer' : '',
              feedback && !feedback.correct && side === feedback.response ? 'is-wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(side)}
            aria-disabled={Boolean(feedback)}
          >
            <OptionKey n={index + 1} />
            {labels[side]}
          </button>
        ))}
      </div>

      <p className="left-right__explain" aria-live="polite">
        {feedback && !feedback.correct ? explain(trial) : ''}
      </p>
    </div>
  )
}

export default LeftRightPlayArea
