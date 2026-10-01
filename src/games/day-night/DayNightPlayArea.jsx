import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Equal, Moon, Sun } from 'lucide-react'
import { ANSWERS, checkAnswer, generateTrial, scoring } from './dayNight.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import OptionKey from '../engine/OptionKey'
import { useGameKeys } from '../engine/useGameKeys'
import './DayNightPlayArea.css'

const FEEDBACK_MS = 550

const PICTURE_ICONS = { sun: Sun, moon: Moon }
const PICTURE_NAMES = { sun: 'Сонце', moon: 'Місяць' }

function DayNightPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleAnswer(answerId) {
    if (feedback) return

    const { correct } = checkAnswer(trial, answerId)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setTrialIndex(next)
      setTrial(generateTrial(level))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: ANSWERS.length,
    onOption: (index) => handleAnswer(ANSWERS[index].id),
  })

  const Picture = PICTURE_ICONS[trial.picture]
  const showRule = level.mode === 'mixed'

  return (
    <div className="day-night">
      <p className="day-night__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      {/* Знак правила — картинкою, а не словом: гра для тих, хто не читає. */}
      {showRule && (
        <p className={`day-night__rule day-night__rule--${trial.rule}`}>
          {trial.rule === 'inverse' ? (
            <ArrowLeftRight size={28} aria-hidden="true" />
          ) : (
            <Equal size={28} aria-hidden="true" />
          )}
          <span className="visually-hidden">
            {trial.rule === 'inverse' ? 'Навпаки' : 'Так само'}
          </span>
        </p>
      )}

      <div
        className={[
          'day-night__picture',
          `day-night__picture--${trial.picture}`,
          feedback ? `is-${feedback}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="img"
        aria-label={PICTURE_NAMES[trial.picture]}
      >
        <Picture size={120} strokeWidth={1.6} aria-hidden="true" />
      </div>

      <div className="day-night__answers">
        {ANSWERS.map((answer, index) => {
          const Icon = PICTURE_ICONS[answer.picture]
          return (
            <button
              key={answer.id}
              type="button"
              className="day-night__answer"
              onClick={() => handleAnswer(answer.id)}
              aria-disabled={Boolean(feedback)}
            >
              <OptionKey n={index + 1} />
              <Icon size={30} aria-hidden="true" />
              {answer.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DayNightPlayArea
