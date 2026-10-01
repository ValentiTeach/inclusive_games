import { useRef, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { HIT_PCT, biasPct, scoring } from './timeSense.config'
import { now } from '../engine/time'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './TimeSensePlayArea.css'

const FEEDBACK_MS = 2000

function seconds(ms) {
  return (ms / 1000).toFixed(1).replace('.', ',')
}

function TimeSensePlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [phase, setPhase] = useState('ready')
  const [last, setLast] = useState(null)
  const startedRef = useRef(null)
  const resultsRef = useRef([])

  function handlePress() {
    if (phase === 'ready') {
      playClick()
      startedRef.current = now()
      setPhase('running')
      return
    }
    if (phase !== 'running') return

    const elapsedMs = Math.round(now() - startedRef.current)
    resultsRef.current.push({ elapsedMs })
    const bias = biasPct(level.targetMs, elapsedMs)
    setLast({ elapsedMs, bias })
    setPhase('feedback')
    if (Math.abs(bias) <= HIT_PCT) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current, level.targetMs))
        return
      }
      setTrialIndex(next)
      setPhase('ready')
    }, FEEDBACK_MS)
  }

  useGameKeys({ enabled: phase !== 'feedback', onSpace: handlePress, onEnter: handlePress })

  const target = level.targetMs / 1000

  return (
    <div className="time-sense">
      <p className="time-sense__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <p className="time-sense__task">
        Зупини через <strong>{target}</strong> {target === 3 ? 'секунди' : 'секунд'}
      </p>

      <div
        className={['time-sense__glass', phase === 'running' ? 'is-running' : ''].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        <Hourglass size={88} strokeWidth={1.4} />
      </div>

      <p className="time-sense__status" aria-live="polite">
        {phase === 'ready' && 'Натисни «Старт» — і рахуй подумки.'}
        {phase === 'running' && 'Рахуй подумки…'}
        {phase === 'feedback' &&
          (Math.abs(last.bias) <= HIT_PCT
            ? `Влучно! Минуло ${seconds(last.elapsedMs)} с.`
            : last.bias < 0
              ? `Зарано: минуло лише ${seconds(last.elapsedMs)} с.`
              : `Запізно: минуло вже ${seconds(last.elapsedMs)} с.`)}
      </p>

      <button
        type="button"
        className={phase === 'running' ? 'time-sense__button is-stop' : 'time-sense__button'}
        onClick={handlePress}
        aria-disabled={phase === 'feedback'}
      >
        {phase === 'running' ? 'Стоп' : 'Старт'}
      </button>
    </div>
  )
}

export default TimeSensePlayArea
