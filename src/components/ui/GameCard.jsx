import { Link } from 'react-router-dom'
import Badge from './Badge'
import { CATEGORIES } from '../../data/games'
import './GameCard.css'

function GameCard({ id, title, category, description, status }) {
  const categoryInfo = CATEGORIES[category]
  const isAvailable = status === 'available'

  const content = (
    <>
      <div className="game-card__top">
        <Badge tone={categoryInfo.color}>{categoryInfo.label}</Badge>
        <Badge tone={isAvailable ? 'thinking' : 'muted'}>
          {isAvailable ? 'Грати' : 'Скоро'}
        </Badge>
      </div>
      <h3 className="game-card__title">{title}</h3>
      <p className="game-card__description">{description}</p>
    </>
  )

  if (isAvailable) {
    return (
      <Link to={`/games/${id}`} className="game-card game-card--available">
        {content}
      </Link>
    )
  }

  return (
    <article className="game-card" aria-disabled="true">
      {content}
    </article>
  )
}

export default GameCard
