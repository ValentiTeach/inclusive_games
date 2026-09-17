import { Sparkles } from 'lucide-react'
import { FELT_OPTIONS } from './felt'
import Button from '../../components/ui/Button'
import CountUpNumber from '../../components/ui/CountUpNumber'
import Confetti from '../../components/ui/Confetti'
import AchievementBadge from '../../components/ui/AchievementBadge'

function ResultsScreen({ score, entries, isNewBest, newAchievements, onRestart, felt, onFelt }) {
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
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                /* Щойно здобуте — тут завжди повна ціль, тож смужки не буде. */
                progress={{ current: 1, target: 1, unlocked: true }}
              />
            ))}
          </div>
        </div>
      )}

      {/*
        Один рядок, три кнопки, жодного обов'язку. Двадцять змін поспіль
        вирішувалося, що корисно, без жодного питання до тих, хто грає, — а бал
        90 може означати і «легко», і «ледве витягнула». Пропустити можна: екран
        не тримає дитину, поки вона не натисне, і порожньо — теж відповідь.
      */}
      <div className="game-shell__felt">
        <p className="game-shell__felt-label" id="felt-label">
          Як тобі було?
        </p>
        <div className="game-shell__felt-options" role="group" aria-labelledby="felt-label">
          {FELT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={
                felt === id
                  ? 'game-shell__felt-button game-shell__felt-button--chosen'
                  : 'game-shell__felt-button'
              }
              aria-pressed={felt === id}
              onClick={() => onFelt(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
