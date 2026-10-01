import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring } from './firstSound.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import { PICTURES } from '../engine/pictures'
import OptionKey from '../engine/OptionKey'
import SpeakButton from '../engine/SpeakButton'
import './FirstSoundPlayArea.css'

const FEEDBACK_MS = 900

function FirstSoundPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleAnswer(letter) {
    if (feedback) return
    const { correct } = checkAnswer(trial, letter)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback({ correct, letter })
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
      setTrial(generateTrial(level, trial))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: trial.options.length,
    onOption: (index) => handleAnswer(trial.options[index]),
  })

  const Picture = PICTURES[trial.icon]

  return (
    <div className="first-sound">
      <p className="first-sound__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="first-sound__prompt">
        {level.position === 'last' ? 'Яким звуком закінчується слово?' : 'З якого звуку починається слово?'}
      </p>

      <div className="first-sound__picture" aria-hidden="true">
        <Picture size={96} strokeWidth={1.5} />
      </div>

      {/* Після відповіді слово відкривається повністю — дитина бачить і чує,
          де стояв звук, а не лише «правильно / ні». */}
      <p className="first-sound__word" aria-live="polite">
        {feedback ? trial.word : trial.masked.split('').map((char, index) =>
          char === '_' ? (
            <span key={index} className="first-sound__gap">
              ?
            </span>
          ) : (
            char
          ),
        )}
      </p>

      <SpeakButton text={trial.word} auto label="Послухати слово" />

      <div className="first-sound__options">
        {trial.options.map((letter, index) => (
          <button
            key={letter}
            type="button"
            className={[
              'first-sound__option',
              feedback && letter === trial.answer ? 'is-answer' : '',
              feedback && !feedback.correct && letter === feedback.letter ? 'is-wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleAnswer(letter)}
            aria-disabled={Boolean(feedback)}
            aria-label={`Звук ${letter}`}
          >
            <OptionKey n={index + 1} />
            {letter}
          </button>
        ))}
      </div>
    </div>
  )
}

export default FirstSoundPlayArea
