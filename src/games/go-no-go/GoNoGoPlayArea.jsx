import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './goNoGo.config'
import { playClick, playCorrect, playWrong } from '../../lib/sound'
import './GoNoGoPlayArea.css'

const GAP_MS = 350

function GoNoGoPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial())
  const [stage, setStage] = useState('stimulus')
  const respondedRef = useRef(false)
  const resultsRef = useRef([])

  useEffect(() => {
    if (stage !== 'stimulus') return undefined

    respondedRef.current = false
    const timer = setTimeout(() => {
      resolveTrial(respondedRef.current ? 'pressed' : 'ignored')
    }, level.windowMs)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, trial])

  function resolveTrial(response) {
    const { correct, outcome } = checkAnswer(trial, response)
    resultsRef.current.push({ correct, outcome })

    if (outcome === 'hit') playCorrect()
    else if (outcome === 'false-alarm') playWrong()

    setStage('gap')
    setTimeout(() => {
      const nextIndex = trialIndex + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setTrialIndex(nextIndex)
      setTrial(generateTrial())
      setStage('stimulus')
    }, GAP_MS)
  }

  function handlePress() {
    if (stage !== 'stimulus' || respondedRef.current) return
    respondedRef.current = true
    playClick()
    resolveTrial('pressed')
  }

  return (
    <div className="go-no-go">
      <p className="go-no-go__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="go-no-go__stage">
        {stage === 'stimulus' && (
          <span
            className={
              trial.isGo ? 'go-no-go__shape go-no-go__shape--go' : 'go-no-go__shape go-no-go__shape--stop'
            }
          />
        )}
      </div>
      <button type="button" className="go-no-go__button" onClick={handlePress}>
        Тисни!
      </button>
    </div>
  )
}

export default GoNoGoPlayArea
