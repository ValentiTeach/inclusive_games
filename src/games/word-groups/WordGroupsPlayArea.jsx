import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, pickGroups, scoring } from './wordGroups.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import { PICTURES } from '../engine/pictures'
import './WordGroupsPlayArea.css'

const FEEDBACK_MS = 900
/* Після «четвертого зайвого» дитина має встигнути прочитати, чому. */
const ODD_FEEDBACK_MS = 1800

function Item({ icon, word, size = 56 }) {
  const Picture = PICTURES[icon]
  return (
    <>
      <Picture size={size} strokeWidth={1.6} aria-hidden="true" />
      <span className="word-groups__word">{word}</span>
    </>
  )
}

function WordGroupsPlayArea({ level, onFinish }) {
  const [groups] = useState(() => pickGroups(level))
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level, groups))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  function handleAnswer(answer) {
    if (feedback) return
    const { correct } = checkAnswer(trial, answer)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - shownAtRef.current) })
    setFeedback({ correct, answer })
    if (correct) playCorrect()
    else playWrong()

    setTimeout(
      () => {
        const next = trialIndex + 1
        if (next >= level.trialCount) {
          onFinish(scoring(resultsRef.current))
          return
        }
        setFeedback(null)
        setTrialIndex(next)
        setTrial(generateTrial(level, groups, trial))
      },
      trial.mode === 'odd' ? ODD_FEEDBACK_MS : FEEDBACK_MS,
    )
  }

  const options = trial.mode === 'odd' ? trial.items.map((item) => item.word) : groups.map((g) => g.id)

  useGameKeys({
    enabled: !feedback,
    optionCount: options.length,
    onOption: (index) => handleAnswer(options[index]),
  })

  return (
    <div className="word-groups">
      <p className="word-groups__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      {trial.mode === 'sort' ? (
        <>
          <p className="word-groups__prompt">До якої групи це належить?</p>
          <div className="word-groups__item">
            <Item icon={trial.item.icon} word={trial.item.word} size={80} />
          </div>
          <div className="word-groups__bins">
            {groups.map((group, index) => {
              const Icon = PICTURES[group.icon]
              return (
                <button
                  key={group.id}
                  type="button"
                  className={[
                    'word-groups__bin',
                    feedback && group.id === trial.answer ? 'is-answer' : '',
                    feedback && !feedback.correct && group.id === feedback.answer ? 'is-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleAnswer(group.id)}
                  aria-disabled={Boolean(feedback)}
                >
                  <OptionKey n={index + 1} />
                  <Icon size={28} aria-hidden="true" />
                  {group.name}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <p className="word-groups__prompt">Що тут зайве?</p>
          <div className="word-groups__odd">
            {trial.items.map((item, index) => (
              <button
                key={item.word}
                type="button"
                className={[
                  'word-groups__odd-item',
                  feedback && item.word === trial.answer ? 'is-answer' : '',
                  feedback && !feedback.correct && item.word === feedback.answer ? 'is-wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleAnswer(item.word)}
                aria-disabled={Boolean(feedback)}
              >
                <OptionKey n={index + 1} />
                <Item icon={item.icon} word={item.word} />
              </button>
            ))}
          </div>
          {/* Пояснення — це і є узагальнення: назвати групу одним словом. */}
          <p className="word-groups__explain" aria-live="polite">
            {feedback &&
              `Решта — ${trial.mainGroup.name.toLowerCase()}, а «${trial.answer}» — ${trial.oddGroup.name.toLowerCase()}.`}
          </p>
        </>
      )}
    </div>
  )
}

export default WordGroupsPlayArea
