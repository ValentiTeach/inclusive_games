import { Link } from 'react-router-dom'
import { GAMES, CATEGORIES } from '../data/games'
import { getResults } from '../games/engine/storage'
import { computeStreak } from '../lib/streak'
import Badge from '../components/ui/Badge'
import Sparkline from '../components/ui/Sparkline'
import Button from '../components/ui/Button'
import './Progress.css'

function average(numbers) {
  return numbers.length ? Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length) : null
}

function Progress() {
  const gamesWithHistory = GAMES.map((game) => ({ game, history: getResults(game.id) })).filter(
    ({ history }) => history.length > 0,
  )

  if (gamesWithHistory.length === 0) {
    return (
      <section className="progress-page">
        <h1>Мій прогрес</h1>
        <p>
          Ще немає жодної зіграної гри. Зіграй у щось із каталогу — і тут з’явиться статистика.
        </p>
        <Button to="/games">До каталогу ігор</Button>
      </section>
    )
  }

  const categoryScores = {}
  const allDates = []

  gamesWithHistory.forEach(({ game, history }) => {
    if (!categoryScores[game.category]) categoryScores[game.category] = []
    history.forEach((attempt) => {
      categoryScores[game.category].push(attempt.score)
      allDates.push(attempt.date.slice(0, 10))
    })
  })

  const { current, longest } = computeStreak(allDates)

  return (
    <section className="progress-page">
      <h1>Мій прогрес</h1>

      <div className="progress-summary">
        <div className="progress-summary__stat">
          <span className="progress-summary__value">{current}</span>
          <span className="progress-summary__label">
            {current === 1 ? 'день поспіль' : 'днів поспіль'}
          </span>
        </div>
        <div className="progress-summary__stat">
          <span className="progress-summary__value">{longest}</span>
          <span className="progress-summary__label">найдовша серія</span>
        </div>
      </div>

      <h2>За категоріями</h2>
      <div className="progress-categories">
        {Object.entries(CATEGORIES).map(([key, info]) => {
          const scores = categoryScores[key]
          const avg = scores ? average(scores) : null

          return (
            <div key={key} className="progress-category">
              <Badge tone={info.color}>{info.label}</Badge>
              <div className="progress-category__bar">
                <div
                  className="progress-category__fill"
                  style={{ width: `${avg ?? 0}%` }}
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

          return (
            <Link key={game.id} to={`/games/${game.id}`} className="progress-game">
              <div className="progress-game__head">
                <span className="progress-game__title">{game.title}</span>
                <Badge tone={CATEGORIES[game.category].color}>
                  {CATEGORIES[game.category].label}
                </Badge>
              </div>
              <Sparkline values={scores} />
              <div className="progress-game__stats">
                <span>Спроб: {history.length}</span>
                <span>Найкращий результат: {best}%</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default Progress
