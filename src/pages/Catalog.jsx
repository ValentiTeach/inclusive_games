import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import GameCard from '../components/ui/GameCard'
import AssignedGames from '../components/student/AssignedGames'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { CATEGORIES, GAMES, NEEDS, gameNeeds } from '../data/games'
import { CATEGORY_ICONS } from '../data/categoryIcons'
import {
  catalogHref,
  categoryFromParams,
  countByCategory,
  filterByCategory,
  filterByNeeds,
  needsFromParams,
} from '../lib/catalogFilter'
import './Catalog.css'

function Catalog() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const gatingActive = isCloudConfigured && !user

  const navigate = useNavigate()
  const active = categoryFromParams(searchParams)
  const without = needsFromParams(searchParams)
  // Лічильники навичок рахуються вже без схованих вимог: число в пігулці має
  // збігатися з тим, що відкриється після натискання.
  const suitable = filterByNeeds(GAMES, without)
  const counts = countByCategory(suitable)
  const visible = filterByCategory(suitable, active)

  function toggleNeed(key) {
    const next = without.includes(key) ? without.filter((need) => need !== key) : [...without, key]
    navigate(catalogHref({ category: active, without: next }), { replace: true })
  }

  return (
    <section>
      <h1>{active ? `Ігри на навик «${CATEGORIES[active].label}»` : 'Каталог ігор'}</h1>
      <p>
        {active
          ? `Тут ${visible.length} із ${suitable.length} ігор — саме ті, що тренують цей навик.`
          : 'Ігри поступово додаються. Обери навик, щоб побачити лише потрібні вправи.'}
        {gatingActive && ' Кілька ігор доступні без входу — решта відкриється після реєстрації.'}
      </p>

      <AssignedGames />

      <nav className="catalog-filters" aria-label="Фільтр за навиком">
        <Link
          to={catalogHref({ without })}
          className={active ? 'catalog-filter' : 'catalog-filter is-active'}
          aria-current={active ? undefined : 'true'}
        >
          Усі
          <span className="catalog-filter__count">{suitable.length}</span>
        </Link>
        {Object.entries(CATEGORIES).map(([key, category]) => {
          const Icon = CATEGORY_ICONS[key]
          const isActive = active === key
          return (
            <Link
              key={key}
              to={catalogHref({ category: key, without })}
              className={
                isActive
                  ? `catalog-filter catalog-filter--${category.color} is-active`
                  : `catalog-filter catalog-filter--${category.color}`
              }
              aria-current={isActive ? 'true' : undefined}
            >
              <Icon size={15} aria-hidden="true" />
              {category.label}
              <span className="catalog-filter__count">{counts[key]}</span>
            </Link>
          )
        })}
      </nav>

      {/*
        Підбір під дитину: сховати ігри з вимогою, якої вона не виконає.
        Кнопки-перемикачі, а не посилання: вони не ведуть деінде, а лише
        звужують те, що вже на екрані.
      */}
      <div className="catalog-needs" role="group" aria-labelledby="catalog-needs-label">
        <span id="catalog-needs-label" className="catalog-needs__label">
          Сховати ігри, якщо дитині:
        </span>
        {Object.entries(NEEDS).map(([key, need]) => (
          <button
            key={key}
            type="button"
            className="catalog-need"
            aria-pressed={without.includes(key)}
            onClick={() => toggleNeed(key)}
          >
            {need.filter}
          </button>
        ))}
      </div>
      {without.length > 0 && (
        <p className="catalog-needs__summary" role="status">
          Сховано ігор: {GAMES.length - suitable.length}.
        </p>
      )}

      <div className="catalog-grid">
        {visible.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            title={game.title}
            category={game.category}
            description={game.description}
            status={game.status}
            beta={game.beta}
            locked={gatingActive && !game.freeForGuests}
            needs={gameNeeds(game.id)}
          />
        ))}
      </div>
    </section>
  )
}

export default Catalog
