import { useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import { CATEGORIES } from '../../data/games'
import { getResults, saveResult } from './storage'
import { suggestLevel } from './suggestLevel'
import { pushResult } from '../../lib/cloudSync'
import IntroScreen from './IntroScreen'
import CountdownScreen from './CountdownScreen'
import ResultsScreen from './ResultsScreen'
import './GameShell.css'

const COUNTDOWN_START = 3
const COUNTDOWN_STEP_MS = 700

function GameShell({ config, renderPlay }) {
  const [phase, setPhase] = useState('intro')
  const [history, setHistory] = useState(() => getResults(config.id))
  const [levelState, setLevelState] = useState(() => suggestLevel(config, history))
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [result, setResult] = useState(null)

  const level = config.levels.find((item) => item.id === levelState.levelId)
  const categoryInfo = CATEGORIES[config.category]

  useEffect(() => {
    if (phase !== 'countdown') return undefined

    const timer = setTimeout(() => {
      setCountdown((value) => {
        if (value <= 1) {
          setPhase('playing')
          return 0
        }
        return value - 1
      })
    }, COUNTDOWN_STEP_MS)

    return () => clearTimeout(timer)
  }, [phase, countdown])

  function handleLevelChange(levelId) {
    setLevelState({ levelId, isAutoSuggested: false })
  }

  function handleStart() {
    setCountdown(COUNTDOWN_START)
    setPhase('countdown')
  }

  function handleFinish(finishResult) {
    setResult(finishResult)
    const updated = saveResult(config.id, { ...finishResult, levelId: levelState.levelId })
    setHistory(updated)
    setPhase('results')
    pushResult(config.id, updated[0])
  }

  function handleRestart() {
    setResult(null)
    setPhase('intro')
  }

  return (
    <div className="game-shell">
      <header className="game-shell__head">
        <Badge tone={categoryInfo.color}>{categoryInfo.label}</Badge>
        <h1>{config.title}</h1>
      </header>

      {phase === 'intro' && (
        <IntroScreen
          config={config}
          levelId={levelState.levelId}
          isAutoSuggested={levelState.isAutoSuggested}
          onLevelChange={handleLevelChange}
          onStart={handleStart}
          history={history}
        />
      )}

      {phase === 'countdown' && <CountdownScreen value={countdown} />}

      {phase === 'playing' && renderPlay(level, handleFinish)}

      {phase === 'results' && result && (
        <ResultsScreen entries={result.entries} onRestart={handleRestart} />
      )}
    </div>
  )
}

export default GameShell
