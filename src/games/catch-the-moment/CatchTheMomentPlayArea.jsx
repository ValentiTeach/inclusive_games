import { useEffect, useRef, useState } from 'react'
import { evaluate, positionAt, randomZone, scoring } from './catchTheMoment.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './CatchTheMomentPlayArea.css'

const FEEDBACK_MS = 700

function CatchTheMomentPlayArea({ level, onFinish }) {
  const [round, setRound] = useState(0)
  const [zone, setZone] = useState(() => randomZone(level))
  const [stopped, setStopped] = useState(null)
  const markerRef = useRef(null)
  const startedAtRef = useRef(now())
  const resultsRef = useRef([])
  const frameRef = useRef(null)
  // Позиція живе в ref, а не в стані: 60 перемальовувань React на секунду
  // заради одного зсуву — це та ціна, яку видно на слабкому шкільному
  // комп'ютері. Стиль пишеться прямо в вузол, як у декоративному фоні.
  const positionRef = useRef(0)

  useEffect(() => {
    if (stopped) return undefined

    function tick() {
      const position = positionAt(now() - startedAtRef.current, level.periodMs)
      positionRef.current = position
      if (markerRef.current) markerRef.current.style.left = `${position}%`
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [stopped, level.periodMs, round])

  function handleStop() {
    if (stopped) return

    const position = positionRef.current
    const result = evaluate(zone, position)
    resultsRef.current.push(result)
    setStopped({ position, ...result })

    if (result.hit) playCorrect()
    else playWrong()

    setTimeout(() => {
      const nextRound = round + 1

      if (nextRound >= level.rounds) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setRound(nextRound)
      setZone(randomZone(level))
      setStopped(null)
      startedAtRef.current = now()
    }, FEEDBACK_MS)
  }

  useGameKeys({ enabled: !stopped, onSpace: handleStop })

  return (
    <div className="catch">
      <p className="catch__progress">
        Раунд {round + 1} / {level.rounds}
      </p>

      <div className="catch__track">
        <span
          className="catch__zone"
          style={{ left: `${zone.start}%`, width: `${zone.end - zone.start}%` }}
        />
        <span
          ref={markerRef}
          className={stopped ? 'catch__marker is-stopped' : 'catch__marker'}
          style={stopped ? { left: `${stopped.position}%` } : undefined}
        />
      </div>

      <p className="catch__status" aria-live="polite">
        {stopped
          ? stopped.hit
            ? `Влучив! Відхилення ${stopped.offsetPct}% смуги`
            : `Мимо на ${stopped.offsetPct}% смуги`
          : 'Тисни, коли бігунець у зеленому'}
      </p>

      <button type="button" className="catch__button" onClick={handleStop} aria-disabled={Boolean(stopped)}>
        Зупинити
      </button>
    </div>
  )
}

export default CatchTheMomentPlayArea
