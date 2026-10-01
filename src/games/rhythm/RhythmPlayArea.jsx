import { useEffect, useRef, useState } from 'react'
import { Ear } from 'lucide-react'
import { beatTimes, checkAnswer, generateTrial, scoring } from './rhythm.config'
import { now } from '../engine/time'
import { isSoundOn, playBeat, playCorrect, playWrong } from '../../lib/sound'
import { useGameKeys } from '../engine/useGameKeys'
import './RhythmPlayArea.css'

const LEAD_IN_MS = 700
const AFTER_LISTEN_MS = 600
const PULSE_MS = 160
const FEEDBACK_MS = 1300
/* Скільки чекати на наступний удар, перш ніж вирішити, що дитина закінчила. */
const IDLE_MS = 2600

function RhythmPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [phase, setPhase] = useState('listen')
  const [pulse, setPulse] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const tapsRef = useRef([])
  const idleRef = useRef(null)
  const resultsRef = useRef([])

  /*
   * Без звуку гра неможлива як слухова, тож ритм показується ще й світлом.
   * Дитина, якій вимкнули звук свідомо, однаково може грати — просто це вже
   * проба на зоровий ритм, і про це сказано на екрані.
   */
  const soundOn = isSoundOn()
  const visual = level.visual || !soundOn

  useEffect(() => {
    if (phase !== 'listen') return undefined

    const timers = beatTimes(trial, level.unitMs).map((time) =>
      setTimeout(() => {
        playBeat()
        setPulse(true)
        setTimeout(() => setPulse(false), PULSE_MS)
      }, LEAD_IN_MS + time),
    )
    const total = LEAD_IN_MS + beatTimes(trial, level.unitMs).at(-1) + AFTER_LISTEN_MS
    timers.push(setTimeout(() => setPhase('tap'), total))

    return () => timers.forEach(clearTimeout)
  }, [phase, trial, level.unitMs])

  useEffect(() => {
    if (phase !== 'tap') return undefined
    // Дитина може й не почати: тоді чекаємо довше, ніж між ударами.
    idleRef.current = setTimeout(() => evaluate(), IDLE_MS * 2)
    return () => clearTimeout(idleRef.current)
    // evaluate читає все з ref, тож перепідписуватись на неї не треба.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function evaluate() {
    clearTimeout(idleRef.current)
    const { correct, errorPct } = checkAnswer(trial, tapsRef.current)
    resultsRef.current.push({ correct, errorPct })
    setFeedback({ correct, taps: tapsRef.current.length })
    setPhase('feedback')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      const next = trialIndex + 1
      if (next >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }
      tapsRef.current = []
      setTapCount(0)
      setFeedback(null)
      setTrialIndex(next)
      setTrial(generateTrial(level))
      setPhase('listen')
    }, FEEDBACK_MS)
  }

  function handleTap() {
    if (phase !== 'tap') return
    tapsRef.current.push(now())
    playBeat({ own: true })
    setTapCount(tapsRef.current.length)

    clearTimeout(idleRef.current)
    if (tapsRef.current.length === trial.gaps.length + 1) {
      evaluate()
      return
    }
    idleRef.current = setTimeout(evaluate, IDLE_MS)
  }

  useGameKeys({ enabled: phase === 'tap', onSpace: handleTap, onEnter: handleTap })

  const beats = trial.gaps.length + 1

  return (
    <div className="rhythm">
      <p className="rhythm__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      {!soundOn && (
        <p className="rhythm__note">
          Звук вимкнено в налаштуваннях, тож ритм показується світлом.
        </p>
      )}

      <p className="rhythm__status" aria-live="polite">
        {phase === 'listen' && 'Слухай…'}
        {phase === 'tap' && 'Тепер ти!'}
        {phase === 'feedback' &&
          (feedback.correct
            ? 'Так само! Молодець.'
            : feedback.taps === beats
              ? 'Удари є, але паузи інші.'
              : `Було ударів: ${beats}, а в тебе: ${feedback.taps}.`)}
      </p>

      <div
        className={[
          'rhythm__lamp',
          visual && pulse ? 'is-on' : '',
          phase === 'listen' && !visual ? 'is-listening' : '',
          feedback ? (feedback.correct ? 'is-right' : 'is-wrong') : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        {phase === 'listen' && !visual && <Ear size={56} />}
      </div>

      <div className="rhythm__taps" aria-hidden="true">
        {Array.from({ length: tapCount }, (_, index) => (
          <span key={index} className="rhythm__tap-dot" />
        ))}
      </div>

      <button
        type="button"
        className="rhythm__drum"
        onPointerDown={(event) => {
          // pointerdown, а не click: клік спрацьовує на відпусканні, і
          // запізнення між дотиком і зарахованим ударом спотворювало б паузи.
          event.preventDefault()
          handleTap()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') event.preventDefault()
        }}
        aria-disabled={phase !== 'tap'}
      >
        Тук
      </button>
    </div>
  )
}

export default RhythmPlayArea
