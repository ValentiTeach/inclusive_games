import { useEffect, useMemo, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './schulte.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './SchultePlayArea.css'

function SchultePlayArea({ level, onFinish }) {
  const trial = useMemo(() => generateTrial(level), [level])
  const [target, setTarget] = useState(1)
  const [mistakes, setMistakes] = useState(0)
  const [flash, setFlash] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef(null)
  const total = level.size * level.size

  useEffect(() => {
    startRef.current = now()
    const id = setInterval(() => {
      setElapsedMs(now() - startRef.current)
    }, 100)
    return () => clearInterval(id)
  }, [])

  function handleCellClick(number) {
    const { correct } = checkAnswer(trial, { clicked: number, expected: target })

    if (!correct) {
      playWrong()
      setMistakes((m) => m + 1)
      setFlash({ number, kind: 'wrong' })
      setTimeout(() => setFlash(null), 200)
      return
    }

    setFlash({ number, kind: 'right' })
    setTimeout(() => setFlash(null), 150)

    if (target === total) {
      playCorrect()
      const finalElapsed = now() - startRef.current
      onFinish(scoring({ elapsedMs: finalElapsed, mistakes, size: level.size }))
      return
    }

    playClick()
    setTarget((t) => t + 1)
  }

  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="schulte">
      <div className="schulte__status">
        <span>
          Шукай: <strong>{target}</strong> з {total}
        </span>
        <span className="schulte__timer">{seconds} с</span>
      </div>
      <div
        className="schulte__grid"
        style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
      >
        {trial.cells.map((number) => {
          const isFlashed = flash?.number === number
          const found = number < target
          return (
            <button
              key={number}
              type="button"
              className={[
                'schulte__cell',
                found ? 'schulte__cell--found' : '',
                isFlashed ? `schulte__cell--${flash.kind}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleCellClick(number)}
              disabled={found}
              aria-label={`Число ${number}`}
            >
              {number}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SchultePlayArea
