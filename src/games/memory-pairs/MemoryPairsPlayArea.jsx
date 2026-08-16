import { useEffect, useMemo, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './memoryPairs.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import Shape from './Shape'
import './Shape.css'
import './MemoryPairsPlayArea.css'

const MISMATCH_DELAY_MS = 700

function MemoryPairsPlayArea({ level, onFinish }) {
  const trial = useMemo(() => generateTrial(level), [level])
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const startRef = useRef(null)

  useEffect(() => {
    startRef.current = now()
  }, [])

  function handleCardClick(card) {
    if (locked || flipped.includes(card.uid) || matched.includes(card.uid)) return

    playClick()
    const nextFlipped = [...flipped, card.uid]
    setFlipped(nextFlipped)

    if (nextFlipped.length < 2) return

    setLocked(true)
    const movesSoFar = moves + 1
    setMoves(movesSoFar)

    const [firstUid, secondUid] = nextFlipped
    const first = trial.cards.find((c) => c.uid === firstUid)
    const second = trial.cards.find((c) => c.uid === secondUid)
    const { correct } = checkAnswer(first, second)

    setTimeout(() => {
      if (correct) {
        playCorrect()
        const nextMatched = [...matched, firstUid, secondUid]
        setMatched(nextMatched)
        setFlipped([])
        setLocked(false)

        if (nextMatched.length === trial.cards.length) {
          const elapsedMs = now() - startRef.current
          onFinish(scoring({ moves: movesSoFar, elapsedMs, pairs: level.pairs }))
        }
        return
      }

      playWrong()
      setFlipped([])
      setLocked(false)
    }, MISMATCH_DELAY_MS)
  }

  return (
    <div className="memory-pairs">
      <p className="memory-pairs__status">Ходи: {moves}</p>
      <div
        className="memory-pairs__grid"
        style={{ gridTemplateColumns: `repeat(${trial.columns}, 1fr)` }}
      >
        {trial.cards.map((card) => {
          const isFaceUp = flipped.includes(card.uid) || matched.includes(card.uid)
          const isMatched = matched.includes(card.uid)
          return (
            <button
              key={card.uid}
              type="button"
              className={[
                'memory-pairs__card',
                isFaceUp ? 'is-flipped' : '',
                isMatched ? 'is-matched' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleCardClick(card)}
              disabled={isFaceUp}
              aria-label={isFaceUp ? `Картка з фігурою` : 'Закрита картка'}
            >
              {isFaceUp && <Shape symbolId={card.symbolId} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MemoryPairsPlayArea
