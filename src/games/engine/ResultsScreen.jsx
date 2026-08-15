import Button from '../../components/ui/Button'

function ResultsScreen({ entries, onRestart }) {
  return (
    <div className="game-shell__results">
      <h2>Результат</h2>
      <dl className="game-shell__results-list">
        {entries.map((entry) => (
          <div key={entry.label} className="game-shell__results-item">
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
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
