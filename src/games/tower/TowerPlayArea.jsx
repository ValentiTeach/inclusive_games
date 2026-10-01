import { useEffect, useRef, useState } from 'react'
import {
  BALLS,
  CAPACITY,
  canMove,
  generateTrial,
  isSolved,
  move,
  moveLimit,
  scoring,
} from './tower.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import ShapeIcon from '../engine/ShapeIcon'
import OptionKey from '../engine/OptionKey'
import './TowerPlayArea.css'

const DONE_MS = 1100

function movesWord(n) {
  if (n === 1) return 'хід'
  return n < 5 ? 'ходи' : 'ходів'
}

function Ball({ id, lifted = false, size = 44 }) {
  const ball = BALLS[id]
  return (
    <span
      className={lifted ? 'tower__ball is-lifted' : 'tower__ball'}
      style={{ background: ball.color, width: size, height: size }}
    >
      {/* Знак усередині — щоб кульки розрізнялися не лише кольором. */}
      <ShapeIcon shape={ball.shape} color="#fff" size={size * 0.42} />
    </span>
  )
}

function Tower({ pegs, lifted, small = false, onPeg, disabled }) {
  return (
    <div className={small ? 'tower__stand tower__stand--small' : 'tower__stand'}>
      {pegs.map((peg, index) => {
        const content = (
          <>
            <span className="tower__rod" style={{ '--slots': CAPACITY[index] }} />
            <span className="tower__stack">
              {peg.map((ball, position) => (
                <Ball
                  key={ball}
                  id={ball}
                  size={small ? 24 : 44}
                  lifted={lifted === index && position === peg.length - 1}
                />
              ))}
            </span>
          </>
        )
        if (small) {
          return (
            <div key={index} className="tower__peg" style={{ '--slots': CAPACITY[index] }}>
              {content}
            </div>
          )
        }
        return (
          <button
            key={index}
            type="button"
            className={lifted === index ? 'tower__peg is-active' : 'tower__peg'}
            style={{ '--slots': CAPACITY[index] }}
            onClick={() => onPeg(index)}
            aria-disabled={disabled}
            aria-label={`Стрижень ${index + 1}: ${
              peg.length ? peg.map((ball) => BALLS[ball].name).join(', ') : 'порожній'
            }`}
          >
            <OptionKey n={index + 1} />
            {content}
          </button>
        )
      })}
    </div>
  )
}

function TowerPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [problem, setProblem] = useState(() => generateTrial(level))
  const [pegs, setPegs] = useState(problem.start)
  const [lifted, setLifted] = useState(null)
  const [moves, setMoves] = useState(0)
  const [shake, setShake] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const problemsRef = useRef([])
  const shownAtRef = useRef(null)
  const planningRef = useRef(undefined)
  const ruleBreaksRef = useRef(0)

  useEffect(() => {
    shownAtRef.current = now()
  }, [problem])

  function finishProblem(solved, finalMoves) {
    problemsRef.current.push({
      solved,
      moves: finalMoves,
      minMoves: problem.minMoves,
      planningMs: planningRef.current,
      ruleBreaks: ruleBreaksRef.current,
    })
    setOutcome(solved ? 'solved' : 'failed')
    if (solved) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(problemsRef.current))
        return
      }
      const nextProblem = generateTrial(level)
      planningRef.current = undefined
      ruleBreaksRef.current = 0
      setTrialIndex(next)
      setProblem(nextProblem)
      setPegs(nextProblem.start)
      setMoves(0)
      setLifted(null)
      setOutcome(null)
    }, DONE_MS)
  }

  function handlePeg(index) {
    if (outcome) return

    if (lifted === null) {
      if (pegs[index].length === 0) return
      playClick()
      setLifted(index)
      return
    }

    if (lifted === index) {
      setLifted(null)
      return
    }

    // Порушення правила — окремий показник: це не помилка плану, а спроба
    // зробити те, чого правила не дозволяють.
    if (!canMove(pegs, lifted, index)) {
      ruleBreaksRef.current += 1
      playWrong()
      setShake(true)
      setTimeout(() => setShake(false), 260)
      return
    }

    if (planningRef.current === undefined) {
      planningRef.current = Math.round(now() - shownAtRef.current)
    }
    const next = move(pegs, lifted, index)
    const nextMoves = moves + 1
    playClick()
    setPegs(next)
    setMoves(nextMoves)
    setLifted(null)

    if (isSolved(next, problem.goal)) finishProblem(true, nextMoves)
    else if (nextMoves >= moveLimit(problem.minMoves)) finishProblem(false, nextMoves)
  }

  useGameKeys({ enabled: !outcome, optionCount: 3, onOption: handlePeg })

  return (
    <div className="tower">
      <p className="tower__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <div className="tower__goal">
        <span className="tower__label">Зразок</span>
        <Tower pegs={problem.goal} small />
      </div>

      <p className="tower__status" aria-live="polite">
        {outcome === 'solved' && (moves === problem.minMoves ? 'Ідеально!' : 'Склав! Можна було коротше.')}
        {outcome === 'failed' && 'Не вийшло — спробуймо наступну.'}
        {!outcome && (
          <>
            Склади за <strong>{problem.minMoves}</strong> {movesWord(problem.minMoves)} · зроблено:{' '}
            {moves}
          </>
        )}
      </p>

      <div className={shake ? 'tower__work is-shaking' : 'tower__work'}>
        <Tower pegs={pegs} lifted={lifted} onPeg={handlePeg} disabled={Boolean(outcome)} />
      </div>
    </div>
  )
}

export default TowerPlayArea
