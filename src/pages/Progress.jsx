import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Trophy } from 'lucide-react'
import { GAMES, CATEGORIES } from '../data/games'
import { CATEGORY_ICONS } from '../data/categoryIcons'
import { ACHIEVEMENTS, achievementProgress } from '../data/achievements'
import { getHistoryOwner, getResults } from '../games/engine/storage'
import { metricLabel } from '../games/engine/metrics'
import { highlightMetrics, improvement } from '../lib/progressMetrics'
import { fetchCloudHistory, mergeHistories } from '../lib/cloudSync'
import {
  onOutboxChange,
  outboxSnapshot,
  pendingCount,
  pendingResults,
  unsentText,
} from '../lib/outbox'
import { useAuth } from '../lib/authContext'
import { computeStreak } from '../lib/streak'
import { computeAchievementStats } from '../lib/achievementStats'
import { dailyGoal, dailyGoalText } from '../lib/dailyGoal'
import Badge from '../components/ui/Badge'
import Sparkline from '../components/ui/Sparkline'
import Button from '../components/ui/Button'
import AchievementBadge from '../components/ui/AchievementBadge'
import CountUpNumber from '../components/ui/CountUpNumber'
import './Progress.css'

function average(numbers) {
  return numbers.length ? Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length) : null
}

/*
 * Спроби, зіграні на цьому пристрої, — але лише якщо вони справді цього учня.
 * Позначку власника ставить перенесення історії при вході; поки воно не
 * відбулося, чужі спроби на спільному комп'ютері показувати не можна.
 */
function localHistoryOf(userId) {
  if (getHistoryOwner() !== userId) return {}
  return Object.fromEntries(GAMES.map((game) => [game.id, getResults(game.id)]))
}

function Progress() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  /*
   * undefined — ще вантажиться; null — хмара не відповіла (немає мережі чи
   * сесії); об'єкт — відповідь. Розрізняти останні два важливо: «не вдалося
   * дізнатися» і «ще нічого не грав» — різні речі, і дитина має бачити саме те,
   * що сталося.
   */
  const [cloudHistory, setCloudHistory] = useState(undefined)
  const [barsVisible, setBarsVisible] = useState(false)
  // Черга змінилась — сторінка перемальовується: лічильник «ще не надіслано»
  // має танути в дитини на очах, коли повертається мережа.
  useSyncExternalStore(onOutboxChange, outboxSnapshot)

  useEffect(() => {
    if (!userId) return undefined

    let cancelled = false
    fetchCloudHistory().then((data) => {
      if (!cancelled) setCloudHistory(data)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  /*
   * Для учня, що ввійшов, правда — це хмара. Але хмара знає лише те, що вже
   * дійшло: гра, зіграна хвилину тому без мережі, лежить у черзі, і без неї
   * дитина бачила б, як щойно зіграна спроба «пропала». Тож до хмари
   * додаються спроби цього пристрою й черга; однакова мить гри — одна спроба.
   *
   * Локальна історія тут потрібна й тоді, коли мережа є: спроба, що пішла з
   * черги вже після завантаження хмари, інакше зникла б з екрана до
   * наступного відкриття сторінки.
   *
   * І поки хмара думає, показуємо те, що є на пристрої. Без мережі supabase-js
   * сам повторює запит тричі з паузами 1, 2 і 4 секунди — сім секунд напису
   * «Завантажуємо…» над іграми, які вже лежать у браузері.
   */
  const onDevice = userId
    ? mergeHistories(localHistoryOf(userId), pendingResults(userId))
    : null
  const signedInHistory = userId ? mergeHistories(cloudHistory ?? {}, onDevice) : null

  const unsent = userId ? pendingCount(userId) : 0
  const cloudUnavailable = Boolean(userId) && cloudHistory === null
  const isLoadingCloud =
    Boolean(userId) && cloudHistory === undefined && Object.keys(onDevice).length === 0

  if (isLoadingCloud) {
    return (
      <section className="progress-page">
        <h1>Мій прогрес</h1>
        <p>Завантажуємо дані з хмари…</p>
      </section>
    )
  }

  const gamesWithHistory = GAMES.map((game) => ({
    game,
    history: userId ? signedInHistory?.[game.id] || [] : getResults(game.id),
  })).filter(({ history }) => history.length > 0)

  /*
   * Про зв'язок — спокійно і без слова «помилка»: для дитини нічого не
   * зламалось, її ігри на місці, просто вчитель побачить їх трохи пізніше.
   */
  const syncNotice = (cloudUnavailable || unsent > 0) && (
    <p className="progress-page__sync" role="status">
      {cloudUnavailable
        ? 'Немає зв’язку з хмарою — показуємо ігри, зіграні на цьому пристрої.'
        : null}
      {cloudUnavailable && unsent > 0 ? ' ' : null}
      {unsent > 0 ? `${unsentText(unsent)} — вчитель побачить їх, щойно з’явиться інтернет.` : null}
    </p>
  )

  if (gamesWithHistory.length === 0) {
    return (
      <section className="progress-page">
        <h1>Мій прогрес</h1>
        {syncNotice}
        <p>
          Ще немає жодної зіграної гри. Зіграй у щось із каталогу — і тут з’явиться статистика.
        </p>
        <Button to="/games">До каталогу ігор</Button>
      </section>
    )
  }

  const categoryScores = {}

  gamesWithHistory.forEach(({ game, history }) => {
    if (!categoryScores[game.category]) categoryScores[game.category] = []
    history.forEach((attempt) => {
      categoryScores[game.category].push(attempt.score)
    })
  })

  const baseStats = computeAchievementStats(gamesWithHistory)
  const { current, longest } = computeStreak(baseStats.dates)
  const achievementStats = { ...baseStats, longestStreak: longest }
  const goal = dailyGoal(baseStats.attemptsToday)

  return (
    <section className="progress-page">
      <h1>Мій прогрес</h1>
      {syncNotice}

      <div className="progress-summary">
        <div className="progress-summary__stat">
          <Flame className="progress-summary__icon" aria-hidden="true" />
          <CountUpNumber value={current} className="progress-summary__value" />
          <span className="progress-summary__label">
            {current === 1 ? 'день поспіль' : 'днів поспіль'}
          </span>
        </div>
        <div className="progress-summary__stat">
          <Trophy className="progress-summary__icon" aria-hidden="true" />
          <CountUpNumber value={longest} className="progress-summary__value" />
          <span className="progress-summary__label">найдовша серія</span>
        </div>
      </div>

      {/*
        Серія показує, що дитина зробила, мета — що робити зараз. Разом вони
        відповідають на обидва питання, з якими сюди заходять.
      */}
      <div className="progress-goal">
        <div className="progress-goal__head">
          <h2 className="progress-goal__title">Сьогодні</h2>
          <span className="progress-goal__count">
            {goal.done} / {goal.target}
          </span>
        </div>
        <span
          className="progress-goal__bar"
          role="progressbar"
          aria-valuenow={goal.done}
          aria-valuemin={0}
          aria-valuemax={goal.target}
          aria-label={`Мета на сьогодні: ${goal.done} з ${goal.target}`}
        >
          <span className="progress-goal__bar-fill" style={{ width: `${goal.percent}%` }} />
        </span>
        <p className="progress-goal__text">{dailyGoalText(goal)}</p>
      </div>

      <h2>Досягнення</h2>
      <div className="progress-achievements">
        {ACHIEVEMENTS.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            progress={achievementProgress(achievement, achievementStats)}
          />
        ))}
      </div>

      <h2>За категоріями</h2>
      <div className="progress-categories">
        {Object.entries(CATEGORIES).map(([key, info]) => {
          const scores = categoryScores[key]
          const avg = scores ? average(scores) : null
          const CategoryIcon = CATEGORY_ICONS[key]

          return (
            <div key={key} className="progress-category">
              <Badge tone={info.color}>
                <CategoryIcon size={13} aria-hidden="true" />
                {info.label}
              </Badge>
              <div className="progress-category__bar">
                <div
                  className="progress-category__fill"
                  style={{ width: barsVisible ? `${avg ?? 0}%` : '0%' }}
                  data-tone={info.color}
                />
              </div>
              <span className="progress-category__value">{avg !== null ? `${avg}%` : '—'}</span>
            </div>
          )
        })}
      </div>

      <h2>Ігри</h2>
      <div className="progress-games">
        {gamesWithHistory.map(({ game, history }) => {
          const scores = [...history].reverse().map((attempt) => attempt.score)
          const best = Math.max(...history.map((attempt) => attempt.score))
          const CategoryIcon = CATEGORY_ICONS[game.category]
          const highlights = highlightMetrics(history)
          const growth = improvement(history)

          return (
            <Link key={game.id} to={`/games/${game.id}`} className="progress-game">
              <div className="progress-game__head">
                <span className="progress-game__title">{game.title}</span>
                <Badge tone={CATEGORIES[game.category].color}>
                  <CategoryIcon size={13} aria-hidden="true" />
                  {CATEGORIES[game.category].label}
                </Badge>
              </div>
              <Sparkline values={scores} />
              <div className="progress-game__stats">
                <span>Спроб: {history.length}</span>
                <span>Найкращий результат: {best}%</span>
                {growth !== null && growth !== 0 && (
                  <span
                    className={
                      growth > 0 ? 'progress-game__growth is-up' : 'progress-game__growth is-down'
                    }
                  >
                    {growth > 0 ? `+${growth}` : growth} за останні спроби
                  </span>
                )}
              </div>

              {/* Показники, які гра міряє, а дитина досі не бачила: найкращий
                  час, обсяг пам'яті, точність. Раніше вони жили лише в базі. */}
              {highlights.length > 0 && (
                <dl className="progress-game__metrics">
                  {highlights.map(({ key, value }) => (
                    <div key={key} className="progress-game__metric">
                      <dt>{metricLabel(key).split(',')[0]}</dt>
                      <dd>
                        {value}
                        {key.endsWith('_ms') ? ' мс' : key.endsWith('_pct') ? '%' : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default Progress
