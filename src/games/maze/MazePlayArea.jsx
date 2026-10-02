import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { DIRS, canMove, generateTrial, scoring, shortestPath, step } from './maze.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './MazePlayArea.css'

const CELL = 40
const DONE_MS = 1000
const PAD = [
  [null, 'up', null],
  ['left', 'down', 'right'],
]
const ICONS = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }
const WORDS = { up: 'вгору', down: 'вниз', left: 'вліво', right: 'вправо' }

function MazePlayArea({ level, onFinish }) {
  const [mazeIndex, setMazeIndex] = useState(0)
  const [maze, setMaze] = useState(() => generateTrial(level))
  const [position, setPosition] = useState(0)
  const [trail, setTrail] = useState([0])
  const [bump, setBump] = useState(false)
  const [done, setDone] = useState(false)
  const statsRef = useRef({ moves: 0, bumps: 0, planningMs: undefined })
  const shownAtRef = useRef(null)
  const resultsRef = useRef([])

  useEffect(() => {
    shownAtRef.current = now()
  }, [maze])

  function move(dirName) {
    if (done) return
    const stats = statsRef.current
    if (!canMove(maze, position, dirName)) {
      stats.bumps += 1
      playWrong()
      setBump(true)
      setTimeout(() => setBump(false), 220)
      return
    }
    if (stats.planningMs === undefined) stats.planningMs = Math.round(now() - shownAtRef.current)
    stats.moves += 1
    const next = step(maze, position, dirName)
    setPosition(next)
    setTrail((value) => [...value, next])

    if (next !== maze.exit) {
      playClick()
      return
    }

    playCorrect()
    setDone(true)
    resultsRef.current.push({ ...stats, shortest: shortestPath(maze) })
    setTimeout(() => {
      const nextIndex = mazeIndex + 1
      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      statsRef.current = { moves: 0, bumps: 0, planningMs: undefined }
      setMazeIndex(nextIndex)
      setMaze(generateTrial(level))
      setPosition(0)
      setTrail([0])
      setDone(false)
    }, DONE_MS)
  }

  /* Дотик до сусідньої клітинки — той самий крок, що й стрілка. */
  function handleCellTap(cell) {
    const x = position % maze.size
    const y = Math.floor(position / maze.size)
    const tx = cell % maze.size
    const ty = Math.floor(cell / maze.size)
    const name = Object.keys(DIRS).find((key) => x + DIRS[key].dx === tx && y + DIRS[key].dy === ty)
    if (name) move(name)
  }

  useGameKeys({ enabled: !done, onArrow: move })

  const size = maze.size * CELL
  const center = (cell) => [(cell % maze.size) * CELL + CELL / 2, Math.floor(cell / maze.size) * CELL + CELL / 2]
  const [bx, by] = center(position)
  const [ex, ey] = center(maze.exit)

  return (
    <div className="maze">
      <p className="maze__progress">
        Лабіринт {mazeIndex + 1} / {level.trialCount}
      </p>

      <svg
        className={bump ? 'maze__field is-bump' : 'maze__field'}
        viewBox={`-2 -2 ${size + 4} ${size + 4}`}
        role="img"
        aria-label={`Лабіринт ${maze.size} на ${maze.size}`}
      >
        {maze.cells.map((_, cell) => {
          const [cx, cy] = center(cell)
          return (
            <rect
              key={`c${cell}`}
              x={cx - CELL / 2}
              y={cy - CELL / 2}
              width={CELL}
              height={CELL}
              className="maze__cell"
              onClick={() => handleCellTap(cell)}
            />
          )
        })}
        <polyline points={trail.map((cell) => center(cell).join(',')).join(' ')} className="maze__trail" />
        <rect x={ex - CELL / 2 + 4} y={ey - CELL / 2 + 4} width={CELL - 8} height={CELL - 8} className="maze__exit" />
        {maze.cells.map((walls, cell) => {
          const x = (cell % maze.size) * CELL
          const y = Math.floor(cell / maze.size) * CELL
          return (
            <g key={`w${cell}`} className="maze__wall">
              {walls.n && <line x1={x} y1={y} x2={x + CELL} y2={y} />}
              {walls.w && <line x1={x} y1={y} x2={x} y2={y + CELL} />}
              {walls.s && cell >= maze.size * (maze.size - 1) && <line x1={x} y1={y + CELL} x2={x + CELL} y2={y + CELL} />}
              {walls.e && (cell + 1) % maze.size === 0 && <line x1={x + CELL} y1={y} x2={x + CELL} y2={y + CELL} />}
            </g>
          )
        })}
        <circle cx={bx} cy={by} r={CELL / 3} className="maze__ball" />
      </svg>

      <div className="maze__pad">
        {PAD.flat().map((dir, index) => {
          if (!dir) return <span key={`gap${index}`} aria-hidden="true" />
          const Icon = ICONS[dir]
          return (
            <button
              key={dir}
              type="button"
              className="maze__key"
              onClick={() => move(dir)}
              aria-label={WORDS[dir]}
              aria-disabled={done}
            >
              <Icon size={28} aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MazePlayArea
