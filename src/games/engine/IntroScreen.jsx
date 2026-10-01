import Button from '../../components/ui/Button'
import { playClick } from '../../lib/sound'
import KeyHint from './KeyHint'
import SpeakButton from './SpeakButton'
import { paceChangesGame, paceNote } from './adapt'

function IntroScreen({
  config,
  levelId,
  isAutoSuggested,
  onLevelChange,
  onStart,
  onPractice,
  pace,
  onPaceChange,
  history,
}) {
  function handleLevelChange(id) {
    playClick()
    onLevelChange(id)
  }

  function handlePaceToggle() {
    playClick()
    onPaceChange?.(pace === 'relaxed' ? 'normal' : 'relaxed')
  }

  const relaxed = pace === 'relaxed'
  const paceMatters = paceChangesGame(config)
  const spoken = [config.description, ...config.instructions].join(' ')

  return (
    <div className="game-shell__intro">
      <p>{config.description}</p>

      <ol className="game-shell__instructions">
        {config.instructions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <div className="game-shell__speak">
        <SpeakButton text={spoken} auto />
      </div>

      <KeyHint hint={config.keyHint} />

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
            {history.length > 0
              ? 'Рівень підібрано автоматично за твоїм попереднім результатом.'
              : 'Ця гра в тебе перша, тож рівень підібрано за схожими іграми.'}
          </p>
        )}
      </div>

      {/*
        Темп — поруч із рівнем, а не лише в налаштуваннях: вирішує його
        дорослий, який сидить поруч із дитиною перед грою, і шукати для цього
        окрему сторінку означало б, що його не ввімкнуть.

        Перемикач є лише там, де темп щось змінює. Де часу й так не обмежено,
        лишається тільки пояснення — і лише коли «без поспіху» вже ввімкнено,
        щоб дорослий не гадав, чому нічого не змінилося.
      */}
      {onPaceChange && (paceMatters || relaxed) && (
        <div className="game-shell__pace">
          {paceMatters && (
            <button
              type="button"
              className={relaxed ? 'game-shell__pace-toggle is-on' : 'game-shell__pace-toggle'}
              onClick={handlePaceToggle}
              aria-pressed={relaxed}
            >
              Без поспіху
            </button>
          )}
          <p className="game-shell__pace-note">
            {paceMatters && !relaxed
              ? 'Для тих, кому потрібно більше часу.'
              : paceNote(config)}
          </p>
        </div>
      )}

      <div className="game-shell__start">
        <Button onClick={onStart}>Почати</Button>
        {onPractice && (
          <Button variant="secondary" onClick={onPractice}>
            Спершу спробувати
          </Button>
        )}
      </div>
      {onPractice && history.length === 0 && (
        <p className="game-shell__practice-offer">
          Вперше в цій грі? Пробна гра коротка, з підказкою, і бали в ній не рахуються.
        </p>
      )}

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
