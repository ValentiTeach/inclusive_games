import { useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { CATEGORIES, GAMES, NEEDS, gameNeeds } from '../data/games'
import { GAME_REGISTRY } from '../games/registry'
import { categoryFromParams } from '../lib/catalogFilter'
import './PrintSheets.css'

function practiceHint(config) {
  const hint = config.practice?.hint
  if (typeof hint === 'function') return hint(config.levels?.[0] ?? {})
  return hint ?? null
}

/**
 * Картки ігор для друку: назва, навик, що вимагає, як грати.
 *
 * Заняття не завжди біля комп'ютера: зламався ноутбук, немає зв'язку, дитині
 * потрібна перерва від екрана, а частину ігор (Що спочатку, Що до чого, Ліво
 * і право) можна провести й з папером. Картка — це правило, яке фахівець
 * тримає в руках, і нагадування, що саме гра тренує.
 *
 * Тексти беруться з тих самих конфігів, що й екран вступу гри, — розійтися
 * їм нема з чого.
 */
function PrintCards() {
  const [params, setParams] = useSearchParams()
  const category = categoryFromParams(params)
  const games = GAMES.filter((game) => !category || game.category === category)

  return (
    <article className="print-sheet">
      <div className="print-sheet__screen-only print-hide">
        <h1>Картки ігор</h1>
        <p>
          Правила кожної гри на окремій картці — для заняття без комп’ютера або як нагадування поруч
          з ним. Чотири картки на аркуш A4.
        </p>
        <label className="print-sheet__label" htmlFor="cards-category">
          Навик
        </label>
        <select
          id="cards-category"
          className="print-sheet__select"
          value={category ?? ''}
          onChange={(event) =>
            setParams(event.target.value ? { category: event.target.value } : {}, { replace: true })
          }
        >
          <option value="">Усі ігри ({GAMES.length})</option>
          {Object.entries(CATEGORIES).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" className="print-sheet__print" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Друкувати картки ({games.length})
        </button>
      </div>

      <ul className="print-cards" aria-label="Картки ігор">
        {games.map((game) => {
          const config = GAME_REGISTRY[game.id]?.config ?? {}
          const hint = practiceHint(config)
          const needs = gameNeeds(game.id)
          return (
            <li key={game.id} className="print-card">
              <p className="print-card__skill">{CATEGORIES[game.category].label}</p>
              <h2 className="print-card__title">{game.title}</h2>
              <p className="print-card__description">{game.description}</p>
              {config.instructions?.length > 0 && (
                <ol className="print-card__steps">
                  {config.instructions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              )}
              {hint && (
                <p className="print-card__hint">
                  <strong>Головне правило:</strong> {hint}
                </p>
              )}
              {needs.length > 0 && (
                <p className="print-card__needs">
                  Потрібно: {needs.map((key) => NEEDS[key].label.toLowerCase()).join(', ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </article>
  )
}

export default PrintCards
