import { useEffect, useMemo, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './memoryPairs.config'
import { now } from '../engine/time'
import { useGameKeys } from '../engine/useGameKeys'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import Shape from './Shape'
import './MemoryPairsPlayArea.css'

const MISMATCH_DELAY_MS = 700

function MemoryPairsPlayArea({ level, onFinish }) {
  const trial = useMemo(() => generateTrial(level), [level])
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const [cursor, setCursor] = useState(0)
  const startRef = useRef(null)
  const cardRefs = useRef([])

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

  /**
   * Стрілки по сітці, без загортання через край.
   *
   * Тут, на відміну від Шульте, набирати нічого: картки сорочкою догори
   * нерозрізненні, і єдине, що має значення, — де саме вони лежать. Саме тому
   * курсор не перестрибує з кінця рядка на початок наступного: у грі на пам'ять
   * це збиває просторову картку, яку дитина будує в голові.
   */
  function moveCursor(direction) {
    const { columns } = trial
    const total = trial.cards.length
    const rows = Math.ceil(total / columns)
    const row = Math.floor(cursor / columns)
    const column = cursor % columns

    const nextRow = direction === 'up' ? Math.max(0, row - 1)
      : direction === 'down' ? Math.min(rows - 1, row + 1)
      : row
    const nextColumn = direction === 'left' ? Math.max(0, column - 1)
      : direction === 'right' ? Math.min(columns - 1, column + 1)
      : column

    const next = Math.min(nextRow * columns + nextColumn, total - 1)
    setCursor(next)
    cardRefs.current[next]?.focus()
  }

  useGameKeys({
    onArrow: moveCursor,
    onEnter: () => handleCardClick(trial.cards[cursor]),
    onSpace: () => handleCardClick(trial.cards[cursor]),
  })

  return (
    <div className="memory-pairs">
      <p className="memory-pairs__status">Ходи: {moves}</p>
      <div
        className="memory-pairs__grid"
        style={{ gridTemplateColumns: `repeat(${trial.columns}, 1fr)` }}
      >
        {trial.cards.map((card, index) => {
          const isFaceUp = flipped.includes(card.uid) || matched.includes(card.uid)
          const isMatched = matched.includes(card.uid)
          return (
            <button
              key={card.uid}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              type="button"
              className={[
                'memory-pairs__card',
                isFaceUp ? 'is-flipped' : '',
                isMatched ? 'is-matched' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleCardClick(card)}
              // Курсор іде за фокусом, інакше дитина, що дійшла до картки Tab'ом,
              // натиснула б Enter — і перевернулася б зовсім інша картка.
              onFocus={() => setCursor(index)}
              // Один tabstop на всю сітку: обходити Tab'ом двадцять чотири
              // картки — це не гра.
              tabIndex={index === cursor ? 0 : -1}
              // aria-disabled, а не disabled: вимкнена кнопка не приймає фокус,
              // а відкриті картки лишаються орієнтирами, повз які треба ходити.
              // Натискання на них і так відсіює перевірка в handleCardClick.
              aria-disabled={isFaceUp}
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
