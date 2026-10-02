import { useEffect, useRef, useState } from 'react'
import { checkAnswer, generateTrial, scoring } from './objectPlace.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import Button from '../../components/ui/Button'
import { PICTURES } from '../engine/pictures'
import './ObjectPlacePlayArea.css'

const FEEDBACK_MS = 900
const MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

function ObjectPlacePlayArea({ level, onFinish }) {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [scene, setScene] = useState(() => generateTrial(level))
  const [phase, setPhase] = useState('show')
  const [askIndex, setAskIndex] = useState(0)
  const [cursor, setCursor] = useState(Math.floor((level.size * level.size) / 2))
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])
  const askedAtRef = useRef(null)

  useEffect(() => {
    if (phase !== 'show') return undefined
    const timer = setTimeout(() => setPhase('ask'), level.showMs)
    return () => clearTimeout(timer)
  }, [phase, level.showMs])

  useEffect(() => {
    if (phase === 'ask') askedAtRef.current = now()
  }, [phase, askIndex])

  const asked = scene.items.find((item) => item.icon === scene.askOrder[askIndex])

  function handleCell(cell) {
    if (phase !== 'ask' || feedback) return
    const { correct } = checkAnswer(asked, cell)
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(now() - askedAtRef.current) })
    setFeedback({ correct, cell })
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      setFeedback(null)
      if (askIndex + 1 < scene.items.length) {
        setAskIndex(askIndex + 1)
        return
      }
      const next = sceneIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setSceneIndex(next)
      setScene(generateTrial(level))
      setAskIndex(0)
      setPhase('show')
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: phase === 'ask' && !feedback,
    onArrow: (dir) => {
      const [dx, dy] = MOVES[dir]
      setCursor((value) => {
        const x = Math.min(level.size - 1, Math.max(0, (value % level.size) + dx))
        const y = Math.min(level.size - 1, Math.max(0, Math.floor(value / level.size) + dy))
        return y * level.size + x
      })
    },
    onEnter: () => handleCell(cursor),
  })

  const placedByCell = Object.fromEntries(scene.items.map((item) => [item.cell, item]))
  const AskedPicture = asked ? PICTURES[asked.icon] : null

  return (
    <div className="object-place">
      <p className="object-place__progress">
        Полиця {sceneIndex + 1} / {level.trialCount}
      </p>

      <div className="object-place__prompt" aria-live="polite">
        {phase === 'show' ? (
          <span>Запамʼятай, де що лежить</span>
        ) : (
          <>
            <span>Де лежав цей предмет?</span>
            <span className="object-place__asked">
              <AskedPicture size={34} aria-hidden="true" />
              {asked.word}
            </span>
          </>
        )}
      </div>

      <div
        className="object-place__shelf"
        style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
        role="grid"
        aria-label="Полиця"
      >
        {Array.from({ length: level.size * level.size }, (_, cell) => {
          const item = placedByCell[cell]
          const showItem = phase === 'show' && item
          const isTruth = feedback && cell === asked.cell
          const Picture = item ? PICTURES[item.icon] : null
          return (
            <button
              key={cell}
              type="button"
              className={[
                'object-place__cell',
                phase === 'ask' && cell === cursor ? 'is-cursor' : '',
                isTruth ? 'is-answer' : '',
                feedback && !feedback.correct && cell === feedback.cell ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setCursor(cell)
                handleCell(cell)
              }}
              aria-disabled={phase !== 'ask' || Boolean(feedback)}
              aria-label={showItem ? item.word : `Клітинка ${cell + 1}`}
            >
              {(showItem || isTruth) && Picture && <Picture size={36} strokeWidth={1.6} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {phase === 'show' && (
        <Button variant="secondary" onClick={() => setPhase('ask')}>
          Готово, запамʼятано
        </Button>
      )}
    </div>
  )
}

export default ObjectPlacePlayArea
