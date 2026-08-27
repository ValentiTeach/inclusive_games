import { Sparkles } from 'lucide-react'
import Button from '../../components/ui/Button'
import CountUpNumber from '../../components/ui/CountUpNumber'
import Confetti from '../../components/ui/Confetti'
import AchievementBadge from '../../components/ui/AchievementBadge'

function ResultsScreen({ score, entries, isNewBest, newAchievements, onRestart }) {
  return (
    <div className="game-shell__results">
      <h2>Результат</h2>

      <div className="game-shell__score">
        {isNewBest && <Confetti />}
        <CountUpNumber value={score} className="game-shell__score-value" />
        <span className="game-shell__score-unit">%</span>
        {isNewBest && (
          <p className="game-shell__score-best">
            <Sparkles size={16} aria-hidden="true" /> Новий особистий рекорд!
          </p>
        )}
      </div>

      <dl className="game-shell__results-list">
        {entries.map((entry) => (
          <div key={entry.label} className="game-shell__results-item">
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>

      {newAchievements.length > 0 && (
        <div className="game-shell__achievements">
          <p className="game-shell__achievements-title">Нове досягнення!</p>
          <div className="game-shell__achievements-list">
            {newAchievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} unlocked />
            ))}
          </div>
        </div>
      )}

      <div className="game-shell__results-actions">
        <Button onClick={onRestart}>Спробувати ще раз</Button>
        <Button to="/games" variant="secondary">
          До каталогу ігор
        </Button>
      </div>
    </div>
  )
}

export default ResultsScreen
