import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, pickItems, scoring } from './analogies.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import { PICTURES } from '../engine/pictures'
import './AnalogiesPlayArea.css'

const FEEDBACK_MS = 2000

function Card({ picture, unknown = false }) {
  if (unknown) {
    return (
      <span className="analogies__card analogies__card--unknown" aria-label="Знак питання">
        ?
      </span>
    )
  }
  const [icon, word] = picture
  const Picture = PICTURES[icon]
  return (
    <span className="analogies__card">
      <Picture size={48} strokeWidth={1.6} aria-hidden="true" />
      <span className="analogies__word">{word}</span>
    </span>
  )
}

function Pair({ left, right, unknown }) {
  return (
    <div className="analogies__pair">
      <Card picture={left} />
      <span className="analogies__arrow" aria-hidden="true">
        →
      </span>
      <Card picture={right} unknown={unknown} />
    </div>
  )
}

function AnalogiesPlayArea({ level, onFinish }) {
  const [items] = useState(() => pickItems(level))
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level, items[0]))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  const total = items.length

  function handleAnswer(word) {
    if (feedback) return
    const { correct, lure } = checkAnswer(trial, word)
    resultsRef.current.push({ correct, lure, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback({ correct, word })
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= total) {
        onFinish(scoring(resultsRef.current, level))
        return
      }
      setFeedback(null)
      setTrialIndex(next)
      setTrial(generateTrial(level, items[next]))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: trial.options.length,
    onOption: (index) => handleAnswer(trial.options[index].word),
  })

  const { item } = trial

  return (
    <div className="analogies">
      <p className="analogies__progress">
        {trialIndex + 1} / {total}
      </p>
      <p className="analogies__prompt">Як пов’язані перші дві? Добери пару так само.</p>

      <div className="analogies__board">
        <Pair left={item.a} right={item.b} />
        <Pair left={item.c} right={item.answer} unknown={!feedback} />
      </div>

      <div className="analogies__options">
        {trial.options.map((option, index) => {
          const Picture = PICTURES[option.icon]
          return (
            <button
              key={option.word}
              type="button"
              className={[
                'analogies__option',
                feedback && option.kind === 'answer' ? 'is-answer' : '',
                feedback && !feedback.correct && option.word === feedback.word ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleAnswer(option.word)}
              aria-disabled={Boolean(feedback)}
            >
              <OptionKey n={index + 1} />
              <Picture size={44} strokeWidth={1.6} aria-hidden="true" />
              <span className="analogies__word">{option.word}</span>
            </button>
          )
        })}
      </div>

      {/* Пояснення — це і є зв'язок, названий словами: заради нього гра. */}
      <p className="analogies__explain" aria-live="polite">
        {feedback ? item.explain : ''}
      </p>
    </div>
  )
}

export default AnalogiesPlayArea
