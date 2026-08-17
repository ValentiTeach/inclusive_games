import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './nback.config'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './NBackPlayArea.css'

const GAP_MS = 300

function NBackPlayArea({ level, onFinish }) {
  const [trialData] = useState(() => generateTrial(level))
  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState('stimulus')
  const [feedback, setFeedback] = useState(null)
  const pressedRef = useRef(false)
  const resultsRef = useRef([])

  function resolveTrial(pressed) {
    if (index >= level.n) {
      const { correct, outcome } = checkAnswer(trialData, index, pressed)
      resultsRef.current.push({ correct, outcome })

      if (outcome === 'hit') {
        playCorrect()
        setFeedback('right')
      } else if (outcome === 'false-alarm' || outcome === 'miss') {
        playWrong()
        setFeedback('wrong')
      }
    }

    setStage('gap')
    setTimeout(() => {
      setFeedback(null)
      const nextIndex = index + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setIndex(nextIndex)
      setStage('stimulus')
    }, GAP_MS)
  }

  useEffect(() => {
    if (stage !== 'stimulus') return undefined

    pressedRef.current = false
    const timer = setTimeout(() => {
      resolveTrial(pressedRef.current)
    }, level.stimulusMs)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index])

  function handlePress() {
    if (stage !== 'stimulus' || pressedRef.current || index < level.n) return
    pressedRef.current = true
    playClick()
  }

  return (
    <div className="nback">
      <p className="nback__progress">
        {index + 1} / {level.trialCount}
      </p>
      <div
        className={['nback__letter', feedback ? `nback__letter--${feedback}` : '']
          .filter(Boolean)
          .join(' ')}
      >
        {stage === 'stimulus' ? trialData.sequence[index] : ''}
      </div>
      <button
        type="button"
        className="nback__button"
        onClick={handlePress}
        disabled={stage !== 'stimulus' || index < level.n}
      >
        Збіг!
      </button>
      {index < level.n && <p className="nback__hint">Запамʼятовуй — поки без відповідей</p>}
    </div>
  )
}

export default NBackPlayArea
