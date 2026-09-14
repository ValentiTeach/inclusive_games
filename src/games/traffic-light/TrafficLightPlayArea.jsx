import { useEffect, useRef, useState } from 'react'
import { nextSignal, randomDelayMs, scoring, signalsOfLevel } from './trafficLight.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import './TrafficLightPlayArea.css'

const FEEDBACK_MS = 550
const EARLY_MS = 700

function TrafficLightPlayArea({ level, onFinish }) {
  const signals = signalsOfLevel(level)
  const [round, setRound] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [signal, setSignal] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)
  const litAtRef = useRef(null)
  const resultsRef = useRef([])
  const earlyRef = useRef(0)
  const previousRef = useRef(null)
  /*
   * Одна відповідь на раунд. Стан оновлюється асинхронно, тож два натискання в
   * одному такті обидва побачили б той самий сигнал і записали б дві відповіді
   * на один вогонь. Мишею так не встигнути, клавіатурою — цілком.
   */
  const answeredRef = useRef(false)

  useEffect(() => {
    answeredRef.current = false
    timerRef.current = setTimeout(() => {
      const next = nextSignal(level, previousRef.current)
      previousRef.current = next.id
      litAtRef.current = now()
      setSignal(next)
    }, randomDelayMs())

    return () => clearTimeout(timerRef.current)
  }, [attempt, level])

  function finishRound() {
    const nextRound = round + 1

    if (nextRound >= level.rounds) {
      onFinish(scoring(resultsRef.current, { early_presses: earlyRef.current }))
      return
    }

    setRound(nextRound)
    setSignal(null)
    setFeedback(null)
    setAttempt((value) => value + 1)
  }

  function handleAnswer(signalId) {
    if (answeredRef.current || feedback) return

    /*
     * Натискання до сигналу — не помилка вибору, а спроба вгадати, тож воно не
     * потрапляє в точність: інакше дитина, яка вгадала наперед і влучила, мала
     * б кращу «реакцію», ніж та, що чесно дочекалася вогню. Рахуємо його
     * окремим показником і повертаємо той самий раунд.
     */
    if (!signal) {
      answeredRef.current = true
      clearTimeout(timerRef.current)
      earlyRef.current += 1
      playWrong()
      setFeedback('early')
      setTimeout(() => {
        setFeedback(null)
        setAttempt((value) => value + 1)
      }, EARLY_MS)
      return
    }

    answeredRef.current = true
    const correct = signalId === signal.id
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - litAtRef.current) })

    if (correct) playCorrect()
    else playWrong()
    setFeedback(correct ? 'right' : 'wrong')
    setTimeout(finishRound, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    optionCount: signals.length,
    onOption: (index) => handleAnswer(signals[index].id),
  })

  return (
    <div className="traffic">
      <p className="traffic__progress">
        Раунд {round + 1} / {level.rounds}
      </p>

      <div className="traffic__box" aria-live="polite">
        {signals.map((item) => {
          const isLit = signal?.id === item.id
          return (
            <span
              key={item.id}
              className={isLit ? 'traffic__lamp is-lit' : 'traffic__lamp'}
              style={{ '--lamp-color': item.color }}
            >
              {/* Назва кольору читається вголос лише тоді, коли вогонь горить:
                  для того, хто не бачить екрана, це і є сигнал. */}
              {isLit && <span className="traffic__lamp-name">{item.action}</span>}
            </span>
          )
        })}
      </div>

      <p className="traffic__status">
        {feedback === 'early' && 'Зарано — дочекайся вогню'}
        {feedback === 'right' && 'Точно!'}
        {feedback === 'wrong' && 'Не той вогонь'}
        {!feedback && (signal ? 'Тисни!' : 'Чекай…')}
      </p>

      <div className="traffic__buttons">
        {signals.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={
              feedback === 'wrong' && signal?.id === item.id
                ? 'traffic__button is-answer'
                : 'traffic__button'
            }
            style={{ '--lamp-color': item.color }}
            onClick={() => handleAnswer(item.id)}
            aria-disabled={Boolean(feedback)}
          >
            <OptionKey n={index + 1} />
            {item.action}
          </button>
        ))}
      </div>
    </div>
  )
}

export default TrafficLightPlayArea
