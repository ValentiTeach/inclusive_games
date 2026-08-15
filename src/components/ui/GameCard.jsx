import Badge from './Badge'
import { CATEGORIES } from '../../data/games'
import './GameCard.css'

function GameCard({ title, category, description }) {
  const categoryInfo = CATEGORIES[category]

  return (
    <article className="game-card" aria-disabled="true">
      <div className="game-card__top">
        <Badge tone={categoryInfo.color}>{categoryInfo.label}</Badge>
        <Badge tone="muted">Скоро</Badge>
      </div>
      <h3 className="game-card__title">{title}</h3>
      <p className="game-card__description">{description}</p>
    </article>
  )
}

export default GameCard
