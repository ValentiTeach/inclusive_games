import { useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import { CATEGORIES } from '../../data/games'
import { getResults, saveResult } from './storage'
import IntroScreen from './IntroScreen'
import CountdownScreen from './CountdownScreen'
import ResultsScreen from './ResultsScreen'
import './GameShell.css'

const COUNTDOWN_START = 3
const COUNTDOWN_STEP_MS = 700

function GameShell({ config, renderPlay }) {
  const [phase, setPhase] = useState('intro')
  const [levelId, setLevelId] = useState(config.levels[0].id)
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [scoreEntries, setScoreEntries] = useState(null)
  const [history, setHistory] = useState(() => getResults(config.id))

  const level = config.levels.find((item) => item.id === levelId)
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

  function handleStart() {
    setCountdown(COUNTDOWN_START)
    setPhase('countdown')
  }

  function handleFinish(entries) {
    setScoreEntries(entries)
    setHistory(saveResult(config.id, entries))
    setPhase('results')
  }

  function handleRestart() {
    setScoreEntries(null)
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
          levelId={levelId}
          onLevelChange={setLevelId}
          onStart={handleStart}
          history={history}
        />
      )}

      {phase === 'countdown' && <CountdownScreen value={countdown} />}

      {phase === 'playing' && renderPlay(level, handleFinish)}

      {phase === 'results' && scoreEntries && (
        <ResultsScreen entries={scoreEntries} onRestart={handleRestart} />
      )}
    </div>
  )
}

export default GameShell
