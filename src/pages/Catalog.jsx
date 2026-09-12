import { Link, useSearchParams } from 'react-router-dom'
import GameCard from '../components/ui/GameCard'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { CATEGORIES, GAMES } from '../data/games'
import { CATEGORY_ICONS } from '../data/categoryIcons'
import { categoryFromParams, countByCategory, filterByCategory } from '../lib/catalogFilter'
import './Catalog.css'

function Catalog() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const gatingActive = isCloudConfigured && !user

  const active = categoryFromParams(searchParams)
  const counts = countByCategory(GAMES)
  const visible = filterByCategory(GAMES, active)

  return (
    <section>
      <h1>{active ? `Ігри на навик «${CATEGORIES[active].label}»` : 'Каталог ігор'}</h1>
      <p>
        {active
          ? `Тут ${visible.length} із ${GAMES.length} ігор — саме ті, що тренують цей навик.`
          : 'Ігри поступово додаються. Обери навик, щоб побачити лише потрібні вправи.'}
        {gatingActive && ' Кілька ігор доступні без входу — решта відкриється після реєстрації.'}
      </p>

      <nav className="catalog-filters" aria-label="Фільтр за навиком">
        <Link
          to="/games"
          className={active ? 'catalog-filter' : 'catalog-filter is-active'}
          aria-current={active ? undefined : 'true'}
        >
          Усі
          <span className="catalog-filter__count">{GAMES.length}</span>
        </Link>
        {Object.entries(CATEGORIES).map(([key, category]) => {
          const Icon = CATEGORY_ICONS[key]
          const isActive = active === key
          return (
            <Link
              key={key}
              to={`/games?category=${key}`}
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
          />
        ))}
      </div>
    </section>
  )
}

export default Catalog
