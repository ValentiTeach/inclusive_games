import GameCard from '../components/ui/GameCard'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { GAMES } from '../data/games'
import './Catalog.css'

function Catalog() {
  const { user } = useAuth()
  const gatingActive = isCloudConfigured && !user

  return (
    <section>
      <h1>Каталог ігор</h1>
      <p>
        Ігри поступово додаються. Поки що це список запланованих вправ — кожна
        з’явиться тут, щойно буде готова.
        {gatingActive && ' Кілька ігор доступні без входу — решта відкриється після реєстрації.'}
      </p>
      <div className="catalog-grid">
        {GAMES.map((game) => (
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
