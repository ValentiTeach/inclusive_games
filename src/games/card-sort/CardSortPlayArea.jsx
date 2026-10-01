import { useEffect, useRef, useState } from 'react'
import { RULE_LABELS, TARGETS, checkAnswer, generateTrial, scoring } from './cardSort.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import OptionKey from '../engine/OptionKey'
import { useGameKeys } from '../engine/useGameKeys'
import './CardSortPlayArea.css'

const FEEDBACK_MS = 550
/* Скільки триває оголошення нового правила. Без паузи зміна проходила б
   непомітно, і помилка вимірювала б неуважність до напису, а не перемикання. */
const ANNOUNCE_MS = 1400

function CardSortPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level, 0))
  const [feedback, setFeedback] = useState(null)
  const [announcing, setAnnouncing] = useState(false)
  const resultsRef = useRef([])
  const shownAtRef = useRef(null)
  const sawSwitchRef = useRef(false)

  useEffect(() => {
    shownAtRef.current = now()
  }, [trial])

  useEffect(() => {
    if (!announcing) return undefined
    const timer = setTimeout(() => setAnnouncing(false), ANNOUNCE_MS)
    return () => clearTimeout(timer)
  }, [announcing])

  function handleAnswer(targetId) {
    if (feedback || announcing) return

    const previous = resultsRef.current.at(-1)
    const switched = Boolean(previous) && previous.rule !== trial.rule
    if (switched && level.mode === 'blocks') sawSwitchRef.current = true

    const { correct } = checkAnswer(trial, targetId)
    resultsRef.current.push({
      correct,
      rule: trial.rule,
      switched,
      ...(level.mode === 'blocks' ? { afterSwitch: sawSwitchRef.current } : {}),
      reactionTimeMs: Math.round(now() - shownAtRef.current),
    })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      const nextTrial = generateTrial(level, next)
      setFeedback(null)
      setTrialIndex(next)
      setTrial(nextTrial)
      // Оголошуємо лише блокову зміну: у грі з рамкою правило показує сама
      // картка, і окреме оголошення підказало б відповідь.
      if (level.mode === 'blocks' && nextTrial.rule !== trial.rule) setAnnouncing(true)
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback && !announcing,
    optionCount: TARGETS.length,
    onOption: (index) => handleAnswer(TARGETS[index].id),
  })

  const showRule = level.mode === 'blocks'

  return (
    <div className="card-sort">
      <p className="card-sort__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      {showRule && (
        <p
          className={announcing ? 'card-sort__rule is-new' : 'card-sort__rule'}
          aria-live="polite"
        >
          {announcing
            ? `Нове правило: ${RULE_LABELS[trial.rule].toLowerCase()}!`
            : RULE_LABELS[trial.rule]}
        </p>
      )}
      {!showRule && <p className="card-sort__rule">Рамка — за формою, без рамки — за кольором</p>}

      <div
        className={[
          'card-sort__card',
          trial.hasBorder ? 'has-border' : '',
          feedback ? `is-${feedback}` : '',
          announcing ? 'is-waiting' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="img"
        aria-label={`Картка: ${trial.card.name}${trial.hasBorder ? ', у рамці' : ''}`}
      >
        <ShapeIcon shape={trial.card.shape} color={trial.card.color} size={72} />
      </div>

      <div className="card-sort__targets">
        {TARGETS.map((target, index) => (
          <button
            key={target.id}
            type="button"
            className="card-sort__target"
            onClick={() => handleAnswer(target.id)}
            aria-disabled={Boolean(feedback) || announcing}
            aria-label={`Кошик: ${target.name}`}
          >
            <OptionKey n={index + 1} />
            <ShapeIcon shape={target.shape} color={target.color} size={48} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default CardSortPlayArea
