import { useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring } from './hiddenFigures.config'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import Button from '../../components/ui/Button'
import { PICTURES } from '../engine/pictures'
import './HiddenFiguresPlayArea.css'

const FEEDBACK_MS = 1400

function HiddenFiguresPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [picked, setPicked] = useState(() => new Set())
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])

  function toggle(icon) {
    if (feedback) return
    playClick()
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(icon)) next.delete(icon)
      else next.add(icon)
      return next
    })
  }

  function submit() {
    if (feedback || picked.size === 0) return
    const result = checkAnswer(trial, picked)
    resultsRef.current.push(result)
    setFeedback(result)
    if (result.correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setPicked(new Set())
      setTrialIndex(next)
      setTrial(generateTrial(level))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: trial.options.length,
    onOption: (index) => toggle(trial.options[index].icon),
    onEnter: submit,
  })

  const hiddenIcons = new Set(trial.hidden.map((item) => item.icon))

  return (
    <div className="hidden-figures">
      <p className="hidden-figures__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <div className="hidden-figures__frame" role="img" aria-label="Предмети, намальовані один поверх одного">
        {trial.hidden.map(({ icon, offset }) => {
          const Picture = PICTURES[icon]
          return (
            <span
              key={icon}
              className="hidden-figures__layer"
              style={{ transform: `translate(${offset[0]}px, ${offset[1]}px)` }}
            >
              <Picture size={150} strokeWidth={1.4} aria-hidden="true" />
            </span>
          )
        })}
      </div>

      <p className="hidden-figures__prompt" aria-live="polite">
        {feedback
          ? feedback.correct
            ? 'Усі знайдено!'
            : `Сховано: ${trial.hidden.map((item) => item.word).join(', ')}.`
          : 'Що тут сховано? Познач усе.'}
      </p>

      <div className="hidden-figures__options">
        {trial.options.map(({ icon, word }, index) => {
          const Picture = PICTURES[icon]
          const isPicked = picked.has(icon)
          return (
            <button
              key={icon}
              type="button"
              className={[
                'hidden-figures__option',
                isPicked ? 'is-picked' : '',
                feedback && hiddenIcons.has(icon) ? 'is-answer' : '',
                feedback && isPicked && !hiddenIcons.has(icon) ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => toggle(icon)}
              aria-pressed={isPicked}
              aria-disabled={Boolean(feedback)}
            >
              <OptionKey n={index + 1} />
              <Picture size={34} strokeWidth={1.6} aria-hidden="true" />
              <span>{word}</span>
            </button>
          )
        })}
      </div>

      <Button onClick={submit} disabled={Boolean(feedback) || picked.size === 0}>
        Готово
      </Button>
    </div>
  )
}

export default HiddenFiguresPlayArea
