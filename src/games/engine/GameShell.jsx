import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { CATEGORIES, GAMES } from '../../data/games'
import { GAME_REGISTRY } from '../registry'
import { ACHIEVEMENTS, isUnlocked } from '../../data/achievements'
import { computeAchievementStats } from '../../lib/achievementStats'
import { computeStreak } from '../../lib/streak'
import { getResults, saveResult, rateLastResult } from './storage'
import { suggestLevel } from './suggestLevel'
import { pushResult, pushRating } from '../../lib/cloudSync'
import { useAuth } from '../../lib/authContext'
import { playVictory, playClick, startAmbient, stopAmbient } from '../../lib/sound'
import IntroScreen from './IntroScreen'
import CountdownScreen from './CountdownScreen'
import ResultsScreen from './ResultsScreen'
import KeyHint from './KeyHint'
import './GameShell.css'

function achievementStatsExcluding(gameId, overrideHistory) {
  const gamesWithHistory = GAMES.map((game) => ({
    game,
    history: game.id === gameId ? overrideHistory : getResults(game.id),
  })).filter(({ history }) => history.length > 0)

  const stats = computeAchievementStats(gamesWithHistory)
  const { longest } = computeStreak(stats.dates)
  return { ...stats, longestStreak: longest }
}

/*
 * Спроби в інших іграх тієї самої категорії — з них suggestLevel добирає рівень
 * для гри, яку дитина відкриває вперше.
 */
function categoryHistoryFor(config) {
  return Object.values(GAME_REGISTRY)
    .map(({ config: peer }) => peer)
    .filter((peer) => peer.category === config.category && peer.id !== config.id)
    .map((peer) => ({ levels: peer.levels, attempts: getResults(peer.id) }))
    .filter((peer) => peer.attempts.length > 0)
}

const COUNTDOWN_START = 3
const COUNTDOWN_STEP_MS = 700

function GameShell({ config, renderPlay }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [phase, setPhase] = useState('intro')
  const [history, setHistory] = useState(() => getResults(config.id))
  const [levelState, setLevelState] = useState(() =>
    suggestLevel(config, history, categoryHistoryFor(config)),
  )
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [result, setResult] = useState(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [felt, setFelt] = useState(null)
  const [leaving, setLeaving] = useState(false)

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

  /*
   * Фон звучить лише поки дитина грає. На екранах вступу й результатів там
   * читають — музика під читанням заважає, а не допомагає. Зупинка стоїть і в
   * прибиранні: якщо піти з гри посеред спроби, звук інакше лишився б грати на
   * весь застосунок.
   */
  useEffect(() => {
    if (phase !== 'playing') return undefined

    startAmbient()
    return () => stopAmbient()
  }, [phase])

  function handleLevelChange(levelId) {
    setLevelState({ levelId, isAutoSuggested: false })
  }

  function handleStart() {
    setCountdown(COUNTDOWN_START)
    setPhase('countdown')
  }

  /*
   * Оцінка зберігається локально одразу, а в хмару йде окремо: локальна копія —
   * та, з якої suggestLevel добирає наступний рівень, і вона має пережити
   * невдалу мережу.
   */
  function handleFelt(value) {
    playClick()
    setFelt(value)
    const updated = rateLastResult(config.id, value)
    setHistory(updated)
    if (updated[0]) pushRating(userId, config.id, updated[0].date, value)
  }

  function handleFinish(finishResult) {
    setResult(finishResult)
    setFelt(null)
    // Гра могла дограти, поки дитина думала над питанням про вихід: лишити
    // його поверх результату означало б питати про те, чого вже немає.
    setLeaving(false)

    const previousBest = history.length ? Math.max(...history.map((entry) => entry.score)) : null
    const statsBefore = achievementStatsExcluding(config.id, history)

    const updated = saveResult(config.id, { ...finishResult, levelId: levelState.levelId })
    setHistory(updated)

    const statsAfter = achievementStatsExcluding(config.id, updated)
    const unlocked = ACHIEVEMENTS.filter(
      (achievement) => !isUnlocked(achievement, statsBefore) && isUnlocked(achievement, statsAfter),
    )

    const isBest = previousBest !== null && finishResult.score > previousBest
    setIsNewBest(isBest)
    setNewAchievements(unlocked)
    setPhase('results')
    pushResult(userId, config.id, updated[0])

    if (isBest || unlocked.length > 0) {
      playVictory()
    }
  }

  function handleRestart() {
    setResult(null)
    setIsNewBest(false)
    setNewAchievements([])
    setPhase('intro')
  }

  /*
   * Вихід посеред гри. Досі дитина, яка почала не ту гру або не той рівень,
   * мусила або догравати до кінця, або йти через меню — а меню посеред гри
   * виглядає як «я зламала».
   *
   * Під час відліку виходимо одразу: там ще нічого не втрачено. Під час гри
   * питаємо, бо спробу справді буде втрачено, і випадковий дотик не має
   * коштувати дитині зіграного.
   */
  function handleLeaveRequest() {
    playClick()
    if (phase === 'countdown') {
      leaveNow()
      return
    }
    setLeaving(true)
  }

  function leaveNow() {
    setLeaving(false)
    setResult(null)
    setIsNewBest(false)
    setNewAchievements([])
    setPhase('intro')
  }

  const inPlay = phase === 'playing' || phase === 'countdown'

  /*
   * Escape — те, чого чекають від «вийти» і на клавіатурі, і в програмах
   * загалом. Коли питання вже на екрані, той самий Escape його знімає:
   * інакше клавіша, яка щойно щось відкрила, не могла б це закрити.
   */
  useEffect(() => {
    if (!inPlay && !leaving) return undefined

    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (leaving) {
        setLeaving(false)
        return
      }
      if (phase === 'countdown') leaveNow()
      else setLeaving(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inPlay, leaving, phase])

  return (
    <div className="game-shell">
      <header className="game-shell__head">
        <div className="game-shell__head-main">
          <Badge tone={categoryInfo.color}>{categoryInfo.label}</Badge>
          <h1>{config.title}</h1>
        </div>

        {inPlay && (
          <button
            type="button"
            className="game-shell__leave"
            onClick={handleLeaveRequest}
          >
            <LogOut size={16} aria-hidden="true" />
            Вийти
          </button>
        )}
      </header>

      {leaving && (
        <div className="game-shell__leave-confirm" role="alertdialog" aria-labelledby="leave-title">
          <p id="leave-title" className="game-shell__leave-question">
            Вийти з гри? Ця спроба не збережеться.
          </p>
          <div className="game-shell__leave-actions">
            <button type="button" className="game-shell__leave-yes" onClick={leaveNow}>
              Вийти
            </button>
            <button
              type="button"
              className="game-shell__leave-no"
              autoFocus
              onClick={() => setLeaving(false)}
            >
              Продовжити гру
            </button>
          </div>
        </div>
      )}

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

      {phase === 'playing' && (
        <>
          {renderPlay(level, handleFinish)}
          <KeyHint hint={config.keyHint} />
        </>
      )}

      {phase === 'results' && result && (
        <ResultsScreen
          score={result.score}
          entries={result.entries}
          isNewBest={isNewBest}
          newAchievements={newAchievements}
          onRestart={handleRestart}
          felt={felt}
          onFelt={handleFelt}
        />
      )}
    </div>
  )
}

export default GameShell
