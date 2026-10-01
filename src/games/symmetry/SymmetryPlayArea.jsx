import { useRef, useState } from 'react'
import { checkAnswer, generateTrial, key, scoring } from './symmetry.config'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import Button from '../../components/ui/Button'
import './SymmetryPlayArea.css'

const FEEDBACK_MS = 1600
const MOVES = { up: [-1, 0], down: [1, 0], left: [0, 1], right: [0, -1] }

function SymmetryPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [painted, setPainted] = useState(() => new Set())
  const [cursor, setCursor] = useState({ row: 0, col: 0 })
  const [feedback, setFeedback] = useState(null)
  const resultsRef = useRef([])

  function toggle(cell) {
    if (feedback) return
    playClick()
    setPainted((value) => {
      const next = new Set(value)
      if (next.has(cell)) next.delete(cell)
      else next.add(cell)
      return next
    })
  }

  function submit() {
    if (feedback) return
    const result = checkAnswer(trial, painted)
    resultsRef.current.push(result)
    setFeedback(result)
    if (result.correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      setFeedback(null)
      setPainted(new Set())
      setTrialIndex(next)
      setTrial(generateTrial(level))
    }, FEEDBACK_MS)
  }

  useGameKeys({
    enabled: !feedback,
    onArrow: (dir) => {
      // На правій половині «вправо» — це далі від лінії, тобто більший стовпець.
      const [dRow, dCol] = MOVES[dir]
      setCursor((value) => ({
        row: Math.min(level.rows - 1, Math.max(0, value.row + dRow)),
        col: Math.min(level.cols - 1, Math.max(0, value.col - dCol)),
      }))
    },
    onSpace: () => toggle(key(cursor.row, cursor.col)),
    onEnter: submit,
  })

  /* Ліва половина малюється від краю до лінії, права — від лінії до краю. */
  const leftCols = Array.from({ length: level.cols }, (_, i) => level.cols - 1 - i)
  const rightCols = Array.from({ length: level.cols }, (_, i) => i)

  function cellClass(cell, side) {
    if (side === 'left') return trial.pattern.has(cell) ? 'symmetry__cell is-model' : 'symmetry__cell'
    const isPainted = painted.has(cell)
    return [
      'symmetry__cell',
      'is-editable',
      isPainted ? 'is-painted' : '',
      feedback && isPainted && !trial.pattern.has(cell) ? 'is-wrong' : '',
      feedback && !isPainted && trial.pattern.has(cell) ? 'is-missed' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <div className="symmetry">
      <p className="symmetry__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="symmetry__status" aria-live="polite">
        {feedback
          ? feedback.correct
            ? 'Точно як у дзеркалі!'
            : `Пропущено: ${feedback.missed}, зайвих: ${feedback.extra}.`
          : 'Домалюй праву половину'}
      </p>

      <div className="symmetry__board" style={{ '--cols': level.cols }}>
        <div className="symmetry__half" style={{ gridTemplateColumns: `repeat(${level.cols}, 1fr)` }} aria-hidden="true">
          {Array.from({ length: level.rows }, (_, row) =>
            leftCols.map((col) => <span key={key(row, col)} className={cellClass(key(row, col), 'left')} />),
          )}
        </div>
        <span className="symmetry__axis" aria-hidden="true" />
        <div className="symmetry__half" style={{ gridTemplateColumns: `repeat(${level.cols}, 1fr)` }} role="grid">
          {Array.from({ length: level.rows }, (_, row) =>
            rightCols.map((col) => {
              const cell = key(row, col)
              return (
                <button
                  key={cell}
                  type="button"
                  className={[
                    cellClass(cell, 'right'),
                    cursor.row === row && cursor.col === col ? 'is-cursor' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setCursor({ row, col })
                    toggle(cell)
                  }}
                  aria-pressed={painted.has(cell)}
                  aria-label={`Рядок ${row + 1}, клітинка ${col + 1} від лінії`}
                />
              )
            }),
          )}
        </div>
      </div>

      <Button onClick={submit} disabled={Boolean(feedback)}>
        Перевірити
      </Button>
    </div>
  )
}

export default SymmetryPlayArea
