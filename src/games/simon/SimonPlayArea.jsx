import { useEffect, useState } from 'react'
import { PADS, extendSequence, checkAnswer, scoring } from './simon.config'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './SimonPlayArea.css'

const SHOW_STEP_MS = 550
const GAP_MS = 250
const START_DELAY_MS = 400

function SimonPlayArea({ level, onFinish }) {
  const [sequence, setSequence] = useState(() => extendSequence([]))
  const [mode, setMode] = useState('showing')
  const [activePad, setActivePad] = useState(null)
  const [inputIndex, setInputIndex] = useState(0)

  useEffect(() => {
    if (mode !== 'showing') return undefined

    let cancelled = false
    let index = 0
    let timeoutId = null

    function showStep() {
      if (cancelled) return

      if (index >= sequence.length) {
        setActivePad(null)
        setMode('waiting')
        return
      }

      setActivePad(sequence[index])
      timeoutId = setTimeout(() => {
        if (cancelled) return
        setActivePad(null)
        timeoutId = setTimeout(() => {
          if (cancelled) return
          index += 1
          showStep()
        }, GAP_MS)
      }, SHOW_STEP_MS)
    }

    timeoutId = setTimeout(showStep, START_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [mode, sequence])

  function handlePadClick(padId) {
    if (mode !== 'waiting') return

    playClick()
    const { correct } = checkAnswer(sequence, inputIndex, padId)

    if (!correct) {
      playWrong()
      onFinish(
        scoring({ roundsCompleted: sequence.length - 1, targetLength: level.targetLength }),
      )
      return
    }

    if (inputIndex + 1 < sequence.length) {
      setInputIndex((i) => i + 1)
      return
    }

    if (sequence.length >= level.targetLength) {
      playCorrect()
      onFinish(scoring({ roundsCompleted: sequence.length, targetLength: level.targetLength }))
      return
    }

    playCorrect()
    setInputIndex(0)
    setSequence((prev) => extendSequence(prev))
    setMode('showing')
  }

  return (
    <div className="simon">
      <p className="simon__status">
        {mode === 'showing' ? 'Дивись уважно…' : 'Повтори послідовність'}
      </p>
      <div className="simon__grid">
        {PADS.map((pad) => (
          <button
            key={pad.id}
            type="button"
            className={activePad === pad.id ? 'simon__pad is-active' : 'simon__pad'}
            style={{ '--pad-color': pad.hex }}
            onClick={() => handlePadClick(pad.id)}
            disabled={mode !== 'waiting'}
            aria-label={`${pad.label} кнопка`}
          />
        ))}
      </div>
      <p className="simon__length">Довжина послідовності: {sequence.length}</p>
    </div>
  )
}

export default SimonPlayArea
