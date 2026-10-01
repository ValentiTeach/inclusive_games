import { useEffect, useRef, useState } from 'react'
import { EMOTIONS, checkAnswer, generateTrial, optionEmotion, scoring } from './emotions.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import SpeakButton from '../engine/SpeakButton'
import Face from './Face'
import './EmotionsPlayArea.css'

const FEEDBACK_MS = 1100

const PROMPTS = {
  match: 'Знайди обличчя з таким самим настроєм',
  name: 'Що відчуває ця людина?',
  situation: 'Що відчуває дитина?',
  action: 'Що краще зробити?',
}

function EmotionsPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleAnswer(emotion) {
    if (feedback) return
    const { correct } = checkAnswer(trial, emotion)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback({ correct, emotion })
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
    onOption: (index) => handleAnswer(optionEmotion(trial.options[index])),
  })

  function optionClass(emotion) {
    return [
      'emotions__option',
      trial.mode === 'name' ? 'emotions__option--word' : '',
      trial.mode === 'action' ? 'emotions__option--action' : '',
      feedback && emotion === trial.answer ? 'is-answer' : '',
      feedback && !feedback.correct && emotion === feedback.emotion ? 'is-wrong' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <div className="emotions">
      <p className="emotions__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="emotions__prompt">{PROMPTS[trial.mode]}</p>

      {trial.mode === 'situation' || trial.mode === 'action' ? (
        <div className="emotions__situation">
          <p>{trial.text}</p>
          <SpeakButton
            text={
              trial.mode === 'action'
                ? `${trial.text} Що краще зробити? ${trial.options.map((o, i) => `${i + 1}: ${o}.`).join(' ')}`
                : trial.text
            }
            auto
            label="Послухати"
          />
        </div>
      ) : (
        <div className="emotions__target">
          <Face emotion={trial.answer} person={trial.person} size={150} label="Обличчя" />
        </div>
      )}

      <div className="emotions__options">
        {trial.options.map((option, index) => {
          const emotion = optionEmotion(option)
          const person = typeof option === 'string' ? trial.person : option.person
          return (
            <button
              key={emotion}
              type="button"
              className={optionClass(emotion)}
              onClick={() => handleAnswer(emotion)}
              aria-disabled={Boolean(feedback)}
              aria-label={trial.mode === 'name' || trial.mode === 'action' ? undefined : EMOTIONS[emotion].name}
            >
              <OptionKey n={index + 1} />
              {trial.mode === 'action' ? (
                emotion
              ) : trial.mode === 'name' ? (
                EMOTIONS[emotion].name
              ) : (
                <Face emotion={emotion} person={person} size={96} />
              )}
            </button>
          )
        })}
      </div>

      <p className="emotions__status" aria-live="polite">
        {feedback &&
          (trial.mode === 'action'
            ? feedback.correct
              ? 'Так, це допоможе.'
              : 'Краще — те, що підсвічено зеленим.'
            : `Це ${EMOTIONS[trial.answer].name.toLowerCase()}.`)}
      </p>
    </div>
  )
}

export default EmotionsPlayArea
