import GameCard from '../components/ui/GameCard'
import { GAMES } from '../data/games'
import './Catalog.css'

function Catalog() {
  return (
    <section>
      <h1>Каталог ігор</h1>
      <p>
        Ігри поступово додаються. Поки що це список запланованих вправ — кожна
        з’явиться тут, щойно буде готова.
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
          />
        ))}
      </div>
    </section>
  )
}

export default Catalog
