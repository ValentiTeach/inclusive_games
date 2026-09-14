import { useEffect, useRef, useState } from 'react'
import {
  BLANK_MS,
  DIGIT_MS,
  LIVES,
  directionFor,
  isCorrect,
  makeSequence,
  scoring,
} from './digitSpan.config'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './DigitSpanPlayArea.css'

const FEEDBACK_MS = 900
const KEYPAD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

function DigitSpanPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [length, setLength] = useState(level.startLength)
  const [sequence, setSequence] = useState(() => makeSequence(level.startLength))
  const [shownIndex, setShownIndex] = useState(0)
  const [phase, setPhase] = useState('show')
  const [typed, setTyped] = useState([])
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const livesRef = useRef(LIVES)

  const direction = directionFor(level, trialIndex)

  /*
   * Цифри показуються по одній, між ними — порожня мить. Без неї дві сусідні
   * цифри зливаються в одне довге число, і дитина не бачить, де закінчилась
   * перша: помилка буде не про пам'ять, а про читання.
   */
  useEffect(() => {
    if (phase !== 'show') return undefined

    const isBlank = shownIndex % 2 === 1
    const digitPosition = Math.floor(shownIndex / 2)
    const isLastBlank = isBlank && digitPosition >= sequence.length - 1

    // Перехід до відповіді робить сам таймер, а не тіло ефекту: стан, змінений
    // прямо в ефекті, дає зайвий рендер і заборонений правилом
    // react-hooks/set-state-in-effect.
    const timer = setTimeout(
      () => {
        if (isLastBlank) setPhase('answer')
        else setShownIndex((value) => value + 1)
      },
      isBlank ? BLANK_MS : DIGIT_MS,
    )
    return () => clearTimeout(timer)
  }, [phase, shownIndex, sequence.length])

  function submit() {
    if (phase !== 'answer' || feedback || typed.length === 0) return

    const correct = isCorrect(sequence, direction, typed)
    resultsRef.current.push({ correct, length: sequence.length, direction })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    /*
     * Довжина росте після успіху і не падає після помилки: обсяг шукається
     * зверху, а не гойдається туди-сюди. Дві помилки на одній довжині — це і є
     * стеля, далі гра не має чого міряти.
     */
    let nextLength = length
    if (correct) {
      livesRef.current = LIVES
      nextLength = Math.min(length + 1, level.maxLength)
    } else {
      livesRef.current -= 1
    }

    const exhausted = livesRef.current <= 0
    const reachedCeiling = correct && length >= level.maxLength

    setTimeout(() => {
      if (exhausted || reachedCeiling) {
        onFinish(scoring(resultsRef.current, { target_length: level.maxLength }))
        return
      }

      setFeedback(null)
      setTyped([])
      setTrialIndex((value) => value + 1)
      setLength(nextLength)
      setSequence(makeSequence(nextLength))
      setShownIndex(0)
      setPhase('show')
    }, FEEDBACK_MS)
  }

  function addDigit(digit) {
    if (phase !== 'answer' || feedback) return
    // Довше за ряд набрати не можна: зайві цифри означали б, що дитина ще
    // друкує, а не помилилась, і зараховувати це як відповідь було б несправедливо.
    setTyped((value) => (value.length >= sequence.length ? value : [...value, digit]))
  }

  useGameKeys({
    enabled: phase === 'answer' && !feedback,
    onDigit: addDigit,
    onEnter: submit,
    onCancel: () => setTyped((value) => value.slice(0, -1)),
  })

  const digitPosition = Math.floor(shownIndex / 2)
  const showingDigit = phase === 'show' && shownIndex % 2 === 0 && digitPosition < sequence.length

  return (
    <div className="span">
      <p className="span__progress">
        Ряд із {sequence.length} цифр · {direction === 'backward' ? 'назад' : 'вперед'}
      </p>

      <div className="span__stage" aria-live="polite">
        {phase === 'show' && (
          <span className="span__digit">{showingDigit ? sequence[digitPosition] : ''}</span>
        )}
        {phase === 'answer' && (
          <span className="span__typed">
            {typed.length ? typed.join(' ') : '—'}
          </span>
        )}
      </div>

      <p className="span__prompt">
        {phase === 'show' && 'Запам’ятовуй…'}
        {phase === 'answer' && !feedback &&
          (direction === 'backward' ? 'Набери ряд з кінця' : 'Набери ряд по порядку')}
        {feedback === 'right' && 'Правильно!'}
        {feedback === 'wrong' && `Було: ${(direction === 'backward' ? [...sequence].reverse() : sequence).join(' ')}`}
      </p>

      {phase === 'answer' && (
        <>
          <div className="span__keypad">
            {KEYPAD.map((digit) => (
              <button
                key={digit}
                type="button"
                className="span__key"
                onClick={() => addDigit(digit)}
                aria-disabled={Boolean(feedback)}
              >
                {digit}
              </button>
            ))}
          </div>
          <div className="span__actions">
            <button
              type="button"
              className="span__action"
              onClick={() => setTyped((value) => value.slice(0, -1))}
              aria-disabled={typed.length === 0}
            >
              Стерти
            </button>
            <button
              type="button"
              className="span__action span__action--primary"
              onClick={submit}
              aria-disabled={typed.length === 0 || Boolean(feedback)}
            >
              Готово
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default DigitSpanPlayArea
