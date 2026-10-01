import Button from '../../components/ui/Button'

/**
 * Кінець пробної гри.
 *
 * Бал не показується навмисно: на пробі не було заліку, і «40 зі 100» тут
 * читалося б як оцінка, а не як «ти вже зрозумів, як грати». Лишаються лише
 * перші рядки підсумку — скільки вийшло, — щоб дорослий бачив, чи правило
 * справді зрозуміле, перш ніж пустити дитину в залікову гру.
 */
function PracticeDoneScreen({ entries, onStart, onPracticeAgain, onBack }) {
  return (
    <div className="game-shell__practice-done">
      <h2>Пробну гру завершено</h2>

      {entries?.length > 0 && (
        <dl className="game-shell__results-list">
          {entries.slice(0, 2).map((entry) => (
            <div key={entry.label} className="game-shell__results-item">
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p>Тепер — по-справжньому. Якщо ще не зрозуміло, як грати, спробуй ще раз.</p>

      <div className="game-shell__results-actions">
        <Button onClick={onStart}>Почати гру</Button>
        <Button variant="secondary" onClick={onPracticeAgain}>
          Ще одна пробна гра
        </Button>
        <Button variant="secondary" onClick={onBack}>
          До опису гри
        </Button>
      </div>
    </div>
  )
}

export default PracticeDoneScreen
