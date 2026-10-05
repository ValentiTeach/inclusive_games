import { useEffect, useMemo, useRef, useState } from 'react'
import { ASPECT, checkTap, generateTrial, isConnected, scoring } from './trail.config'
import { now } from '../engine/time'
import { useGameKeys } from '../engine/useGameKeys'
import { nearestInDirection } from '../engine/spatial'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './TrailPlayArea.css'

const FLASH_MS = 220

const SHAPE_NAMES = { circle: 'у колі', square: 'у квадраті' }

function nodeLabel(node, kind) {
  if (kind === 'shapes') return `${node.label} ${SHAPE_NAMES[node.shape]}`
  return node.group === 'letter' ? `Літера ${node.label}` : `Число ${node.label}`
}

function TrailPlayArea({ level, onFinish }) {
  const trial = useMemo(() => generateTrial(level), [level])
  const byId = useMemo(() => Object.fromEntries(trial.nodes.map((node) => [node.id, node])), [trial])
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState(0)
  const [perseverations, setPerseverations] = useState(0)
  const [flash, setFlash] = useState(null)
  const [cursor, setCursor] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef(null)
  const finishedRef = useRef(false)
  const nodeRefs = useRef([])

  useEffect(() => {
    startRef.current = now()
    const id = setInterval(() => setElapsedMs(now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [])

  function handleTap(node) {
    if (finishedRef.current || isConnected(trial, step, node.id)) return

    const { correct, perseveration } = checkTap(trial, step, node)
    if (!correct) {
      playWrong()
      setErrors((count) => count + 1)
      if (perseveration) setPerseverations((count) => count + 1)
      setFlash({ id: node.id, kind: 'wrong' })
      setTimeout(() => setFlash(null), FLASH_MS)
      return
    }

    const next = step + 1
    setFlash({ id: node.id, kind: 'right' })
    setTimeout(() => setFlash(null), FLASH_MS)

    if (next === trial.path.length) {
      finishedRef.current = true
      playCorrect()
      setStep(next)
      onFinish(
        scoring({
          elapsedMs: now() - startRef.current,
          errors,
          perseverations,
          level,
        }),
      )
      return
    }

    playClick()
    setStep(next)
  }

  /*
   * Стрілки ведуть до найближчого кружечка в тому напрямку, куди показують, —
   * як у «Пошуку цілі». Порядок у DOM перемішаний навмисно, тож Tab тут —
   * лотерея, а стрілка — та сама дія, що й погляд.
   */
  useGameKeys({
    onArrow: (direction) => {
      const next = nearestInDirection(trial.nodes, cursor, direction, { aspect: ASPECT })
      setCursor(next)
      nodeRefs.current[next]?.focus()
    },
    onEnter: () => handleTap(trial.nodes[cursor]),
    onSpace: () => handleTap(trial.nodes[cursor]),
  })

  const connected = trial.path.slice(0, step).map((id) => byId[id])
  const start = byId[trial.path[0]]
  const finish = byId[trial.path.at(-1)]
  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="trail">
      <div className="trail__status">
        <span>
          З’єднано: <strong>{step}</strong> з {trial.path.length}
        </span>
        {!level.relaxed && <span className="trail__timer">{seconds} с</span>}
      </div>

      <div className="trail__field">
        <svg className="trail__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {connected.slice(1).map((node, index) => (
            <line
              key={node.id}
              x1={connected[index].x}
              y1={connected[index].y}
              x2={node.x}
              y2={node.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {trial.nodes.map((node, index) => {
          const done = isConnected(trial, step, node.id)
          const isLast = step > 0 && node.id === trial.path[step - 1]
          return (
            <button
              key={node.id}
              ref={(element) => {
                nodeRefs.current[index] = element
              }}
              type="button"
              className={[
                'trail__node',
                `trail__node--${node.shape}`,
                done ? 'is-done' : '',
                isLast ? 'is-last' : '',
                flash?.id === node.id ? `is-${flash.kind}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={() => handleTap(node)}
              onFocus={() => setCursor(index)}
              tabIndex={index === cursor ? 0 : -1}
              aria-disabled={done}
              aria-label={nodeLabel(node, trial.kind)}
            >
              {node.label}
              {node === start && <span className="trail__mark">Старт</span>}
              {node === finish && <span className="trail__mark">Фініш</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TrailPlayArea
