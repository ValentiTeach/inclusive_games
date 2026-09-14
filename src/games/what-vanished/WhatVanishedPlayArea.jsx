import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, gridShape, remainingItems, scoring } from './whatVanished.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import OptionKey from '../engine/OptionKey'
import { useGameKeys } from '../engine/useGameKeys'
import './WhatVanishedPlayArea.css'

const GAP_MS = 600
const FEEDBACK_MS = 700

function WhatVanishedPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [phase, setPhase] = useState('show')
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const askedAtRef = useRef(null)

  /*
   * Показ → порожній екран → питання. Порожня мить між ними потрібна: без неї
   * зниклий предмет можна впіймати периферійним зором як зміну на місці, не
   * згадуючи набір, — і гра міряла б увагу до руху, а не пам'ять.
   */
  useEffect(() => {
    if (phase !== 'show') return undefined
    const timer = setTimeout(() => setPhase('gap'), level.showMs)
    return () => clearTimeout(timer)
  }, [phase, level.showMs, trialIndex])

  useEffect(() => {
    if (phase !== 'gap') return undefined
    const timer = setTimeout(() => {
      askedAtRef.current = now()
      setPhase('ask')
    }, GAP_MS)
    return () => clearTimeout(timer)
  }, [phase])

  function handleAnswer(optionId) {
    if (phase !== 'ask' || feedback) return

    const { correct } = checkAnswer(trial, optionId)
    resultsRef.current.push({
      correct,
      reactionTimeMs: Math.round(now() - askedAtRef.current),
    })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const nextIndex = trialIndex + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current, { set_size: level.setSize }))
        return
      }

      setFeedback(null)
      setTrialIndex(nextIndex)
      setTrial(generateTrial(level))
      setPhase('show')
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: phase === 'ask' && !feedback,
    optionCount: trial.options.length,
    onOption: (index) => handleAnswer(trial.options[index].id),
  })

  const shown = phase === 'show' ? trial.items : remainingItems(trial)
  const grid = gridShape(level.setSize)

  return (
    <div className="vanished">
      <p className="vanished__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <p className="vanished__prompt" aria-live="polite">
        {phase === 'show' && 'Запам’ятай предмети'}
        {phase === 'gap' && '…'}
        {phase === 'ask' && !feedback && 'Що зникло?'}
        {feedback === 'right' && 'Так, саме він!'}
        {feedback === 'wrong' && 'Ні, зник інший'}
      </p>

      <div
        className={phase === 'gap' ? 'vanished__set is-hidden' : 'vanished__set'}
        style={{ '--cols': grid.columns, '--rows': grid.rows }}
      >
        {shown.map((item) => (
          <span key={item.id} className="vanished__item">
            <ShapeIcon shape={item.shape} color={item.color} size={44} />
          </span>
        ))}
      </div>

      {/* Варіанти з'являються лише після зникнення: показані разом із набором,
          вони підказували б, на які саме предмети дивитися уважніше. */}
      {phase === 'ask' && (
        <div className="vanished__options">
          {trial.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              className={[
                'vanished__option',
                feedback && option.id === trial.missingId ? 'is-answer' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleAnswer(option.id)}
              aria-disabled={Boolean(feedback)}
            >
              <OptionKey n={index + 1} />
              <ShapeIcon shape={option.shape} color={option.color} size={38} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default WhatVanishedPlayArea
