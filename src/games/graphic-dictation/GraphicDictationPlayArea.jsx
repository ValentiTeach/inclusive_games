import { useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import {
  DIRECTIONS,
  checkAnswer,
  commandAt,
  commandWords,
  generateTrial,
  scoring,
} from './graphicDictation.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import SpeakButton from '../engine/SpeakButton'
import './GraphicDictationPlayArea.css'

const CELL = 30
const DONE_MS = 900
const ARROW_ICONS = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }
/* Хрестом, як на клавіатурі: стрілка вгору над стрілкою вниз. */
const PAD = [
  [null, 'up', null],
  ['left', 'down', 'right'],
]

function Grid({ trial, upTo, small = false }) {
  const width = trial.cols * CELL
  const height = trial.rows * CELL
  const drawn = trial.points.slice(0, upTo + 1)
  const head = drawn.at(-1)

  return (
    <svg
      className={small ? 'dictation__grid dictation__grid--sample' : 'dictation__grid'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={small ? 'Зразок візерунка' : `Пройдено кроків: ${upTo} з ${trial.steps.length}`}
    >
      {Array.from({ length: trial.cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={height} className="dictation__cell-line" />
      ))}
      {Array.from({ length: trial.rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * CELL} x2={width} y2={i * CELL} className="dictation__cell-line" />
      ))}
      {drawn.length > 1 && (
        <polyline
          points={drawn.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
          className="dictation__path"
        />
      )}
      <circle cx={trial.points[0].x * CELL} cy={trial.points[0].y * CELL} r={7} className="dictation__start" />
      {!small && <circle cx={head.x * CELL} cy={head.y * CELL} r={5} className="dictation__head" />}
    </svg>
  )
}

function GraphicDictationPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [stepIndex, setStepIndex] = useState(0)
  const [shake, setShake] = useState(false)
  const [done, setDone] = useState(false)
  const totalsRef = useRef({ steps: 0, errors: 0 })
  const startRef = useRef(null)

  function handleDirection(dir) {
    if (done) return
    if (startRef.current === null) startRef.current = now()

    const { correct } = checkAnswer(trial, stepIndex, dir)
    if (!correct) {
      totalsRef.current.errors += 1
      playWrong()
      setShake(true)
      setTimeout(() => setShake(false), 260)
      return
    }

    totalsRef.current.steps += 1
    const next = stepIndex + 1
    setStepIndex(next)

    if (next < trial.steps.length) {
      playClick()
      return
    }

    playCorrect()
    setDone(true)
    setTimeout(() => {
      const nextTrial = trialIndex + 1
      if (nextTrial >= level.trialCount) {
        onFinish(scoring({ ...totalsRef.current, elapsedMs: now() - startRef.current }))
        return
      }
      setTrialIndex(nextTrial)
      setTrial(generateTrial(level, trial))
      setStepIndex(0)
      setDone(false)
    }, DONE_MS)
  }

  useGameKeys({ enabled: !done, onArrow: handleDirection })

  const current = commandAt(trial.commands, stepIndex)
  const currentCommand = trial.commands[current.index]

  return (
    <div className="dictation">
      <p className="dictation__progress">
        Візерунок {trialIndex + 1} / {level.trialCount}
      </p>

      {level.mode === 'copy' ? (
        <div className="dictation__sample">
          <span className="dictation__sample-label">Зразок</span>
          <Grid trial={trial} upTo={trial.steps.length} small />
        </div>
      ) : (
        <>
          <ol className="dictation__commands" aria-label="Команди">
            {trial.commands.map((command, index) => (
              <li
                key={index}
                className={[
                  'dictation__command',
                  index < current.index ? 'is-done' : '',
                  index === current.index ? 'is-current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={index === current.index ? 'step' : undefined}
              >
                {level.mode === 'arrows'
                  ? `${command.n} ${DIRECTIONS[command.dir].arrow}`
                  : commandWords(command)}
              </li>
            ))}
          </ol>
          {/* Справжній диктант звучить: у режимі «Автоматично» кожна нова
              команда промовляється сама, щойно попередню виконано. */}
          {level.mode === 'words' && currentCommand && (
            <SpeakButton text={commandWords(currentCommand)} auto label="Послухати команду" />
          )}
        </>
      )}

      <div className={shake ? 'dictation__board is-shaking' : 'dictation__board'}>
        <Grid trial={trial} upTo={stepIndex} />
      </div>

      <div className="dictation__pad">
        {PAD.flat().map((dir, index) =>
          dir ? (
            <button
              key={dir}
              type="button"
              className="dictation__key"
              onClick={() => handleDirection(dir)}
              aria-label={DIRECTIONS[dir].word}
              aria-disabled={done}
            >
              {(() => {
                const Icon = ARROW_ICONS[dir]
                return <Icon size={30} aria-hidden="true" />
              })()}
            </button>
          ) : (
            <span key={`gap${index}`} aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  )
}

export default GraphicDictationPlayArea
