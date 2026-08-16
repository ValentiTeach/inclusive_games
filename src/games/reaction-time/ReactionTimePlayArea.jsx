import { useEffect, useRef, useState } from 'react'
import { randomDelayMs, scoring } from './reactionTime.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './ReactionTimePlayArea.css'

const TOO_SOON_RETRY_MS = 900

function ReactionTimePlayArea({ level, onFinish }) {
  const [round, setRound] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('waiting')
  const timerRef = useRef(null)
  const signalAtRef = useRef(null)
  const timesRef = useRef([])

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      signalAtRef.current = now()
      setStatus('ready')
    }, randomDelayMs())

    return () => clearTimeout(timerRef.current)
  }, [attempt])

  function handleClick() {
    if (status === 'waiting') {
      clearTimeout(timerRef.current)
      playWrong()
      setStatus('too-soon')
      setTimeout(() => {
        setStatus('waiting')
        setAttempt((a) => a + 1)
      }, TOO_SOON_RETRY_MS)
      return
    }

    if (status !== 'ready') return

    const reactionTimeMs = Math.round(now() - signalAtRef.current)
    timesRef.current.push(reactionTimeMs)

    if (round + 1 >= level.rounds) {
      playCorrect()
      onFinish(scoring(timesRef.current))
      return
    }

    playClick()
    setStatus('waiting')
    setRound((r) => r + 1)
    setAttempt((a) => a + 1)
  }

  const label = {
    waiting: 'Чекай…',
    ready: 'Тисни!',
    'too-soon': 'Зарано! Спробуй ще раз',
  }[status]

  return (
    <div className="reaction">
      <p className="reaction__progress">
        Раунд {round + 1} / {level.rounds}
      </p>
      <button
        type="button"
        className={`reaction__pad reaction__pad--${status}`}
        onClick={handleClick}
      >
        {label}
      </button>
    </div>
  )
}

export default ReactionTimePlayArea
