import Button from '../../components/ui/Button'
import { playClick } from '../../lib/sound'

function IntroScreen({ config, levelId, isAutoSuggested, onLevelChange, onStart, history }) {
  function handleLevelChange(id) {
    playClick()
    onLevelChange(id)
  }

  return (
    <div className="game-shell__intro">
      <p>{config.description}</p>

      <ol className="game-shell__instructions">
        {config.instructions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <div className="game-shell__levels">
        <span className="game-shell__levels-label">Складність</span>
        <div className="game-shell__levels-options">
          {config.levels.map((level) => (
            <button
              key={level.id}
              type="button"
              className={
                level.id === levelId
                  ? 'game-shell__level-btn is-active'
                  : 'game-shell__level-btn'
              }
              onClick={() => handleLevelChange(level.id)}
              aria-pressed={level.id === levelId}
            >
              {level.label}
            </button>
          ))}
        </div>
        {isAutoSuggested && (
          <p className="game-shell__auto-note">
            Рівень підібрано автоматично за твоїм попереднім результатом.
          </p>
        )}
      </div>

      <Button onClick={onStart}>Почати</Button>

      {history.length > 0 && (
        <div className="game-shell__history">
          <span className="game-shell__levels-label">Останні спроби</span>
          <ul>
            {history.slice(0, 5).map((attempt) => (
              <li key={attempt.date}>
                <span className="game-shell__history-date">
                  {new Date(attempt.date).toLocaleDateString('uk-UA')}
                </span>
                <span>{attempt.entries[0]?.value}</span>
                <span className="game-shell__history-score">{attempt.score}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default IntroScreen
