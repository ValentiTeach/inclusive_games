import { useRef, useState } from 'react'
import { advance, generateTrial, isFinished, scoring, VIEW } from './tracePath.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './TracePathPlayArea.css'

const DONE_MS = 900
/* Найбільша пауза між рухами, яка ще рахується часом: інакше дитина, що
   відвернулася з пальцем на екрані, отримувала б «вихід» за всю паузу. */
const MAX_STEP_MS = 120
const KEY_STEP = 10
const KEY_WEIGHT_MS = 100
const KEY_MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

const FRESH = { progress: 0, insideMs: 0, outsideMs: 0, exits: 0, inside: true }

function TracePathPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [state, setState] = useState(FRESH)
  const [tracing, setTracing] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hint, setHint] = useState('')
  const [done, setDone] = useState(false)
  const svgRef = useRef(null)
  const lastMoveRef = useRef(null)
  const pathsRef = useRef([])
  const startRef = useRef(null)
  const stateRef = useRef(FRESH)
  // Рухи пальця приходять пачкою, і кілька можуть дійти до фінішу раніше,
  // ніж React перемалює «done». Без цього доріжка зараховувалась би двічі.
  const doneRef = useRef(false)

  function toField(event) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
    }
  }

  function apply(position, weight) {
    if (doneRef.current) return
    const previous = stateRef.current
    const next = advance(previous, trial, position, weight)
    if (previous.inside && !next.inside) playWrong()
    stateRef.current = next
    setState(next)
    setCursor(position)
    if (isFinished(next, trial)) finishPath(next)
  }

  function finishPath(finalState) {
    if (doneRef.current) return
    doneRef.current = true
    setTracing(false)
    setDone(true)
    playCorrect()
    pathsRef.current.push(finalState)
    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(pathsRef.current, now() - startRef.current))
        return
      }
      stateRef.current = FRESH
      doneRef.current = false
      setState(FRESH)
      setCursor(null)
      setDone(false)
      setTrialIndex(next)
      setTrial(generateTrial(level, trial))
    }, DONE_MS)
  }

  /*
   * Почати можна лише з того місця, де доріжку покинуто: зі старту або з
   * останньої пройденої точки. Інакше відпустити палець і поставити його ближче
   * до фінішу було б коротшим шляхом.
   */
  function handlePointerDown(event) {
    if (done) return
    const position = toField(event)
    const anchor = trial.points[stateRef.current.progress]
    if (Math.hypot(anchor.x - position.x, anchor.y - position.y) > trial.width / 2 + 12) {
      setHint(stateRef.current.progress === 0 ? 'Почни із зеленого кола.' : 'Продовж із того місця, де зупинився.')
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (startRef.current === null) startRef.current = now()
    lastMoveRef.current = now()
    setHint('')
    setTracing(true)
    setCursor(position)
  }

  function handlePointerMove(event) {
    if (!tracing || done) return
    const at = now()
    const weight = Math.min(MAX_STEP_MS, at - lastMoveRef.current)
    lastMoveRef.current = at
    apply(toField(event), weight)
  }

  function handlePointerUp() {
    setTracing(false)
  }

  /*
   * Без миші й дотику — стрілками. Це вже не зовсім графомоторика, але
   * дитина, яка керує лише клавіатурою, однаково тренує зорове ведення лінії.
   */
  function handleArrow(dir) {
    if (done) return
    if (startRef.current === null) startRef.current = now()
    const from = cursor ?? trial.points[stateRef.current.progress]
    const [dx, dy] = KEY_MOVES[dir]
    apply({ x: from.x + dx * KEY_STEP, y: from.y + dy * KEY_STEP }, KEY_WEIGHT_MS)
  }

  useGameKeys({ enabled: !done, onArrow: handleArrow })

  const centerline = trial.points.map((p) => `${p.x},${p.y}`).join(' ')
  const passed = trial.points
    .slice(0, state.progress + 1)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
  const start = trial.points[0]
  const finish = trial.points.at(-1)

  return (
    <div className="trace">
      <p className="trace__progress">
        Доріжка {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="trace__status" aria-live="polite">
        {hint || (state.inside ? '' : 'Повернись на доріжку')}
      </p>

      <svg
        ref={svgRef}
        className={['trace__field', tracing ? 'is-tracing' : '', state.inside ? '' : 'is-outside']
          .filter(Boolean)
          .join(' ')}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label={`Доріжка: пройдено ${Math.round((state.progress / (trial.points.length - 1)) * 100)}%`}
      >
        <polyline points={centerline} className="trace__edge" style={{ strokeWidth: trial.width + 6 }} />
        <polyline points={centerline} className="trace__road" style={{ strokeWidth: trial.width }} />
        <polyline points={centerline} className="trace__guide" />
        {state.progress > 0 && <polyline points={passed} className="trace__passed" />}
        <circle cx={start.x} cy={start.y} r={Math.min(16, trial.width / 2)} className="trace__start" />
        <circle cx={finish.x} cy={finish.y} r={Math.min(16, trial.width / 2)} className="trace__finish" />
        {cursor && <circle cx={cursor.x} cy={cursor.y} r={7} className="trace__cursor" />}
      </svg>
    </div>
  )
}

export default TracePathPlayArea
