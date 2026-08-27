import { Link } from 'react-router-dom'
import { Lock, Play, Clock } from 'lucide-react'
import Badge from './Badge'
import { CATEGORIES } from '../../data/games'
import { CATEGORY_ICONS } from '../../data/categoryIcons'
import './GameCard.css'

function GameCard({ id, title, category, description, status, beta, locked }) {
  const categoryInfo = CATEGORIES[category]
  const CategoryIcon = CATEGORY_ICONS[category]
  const isAvailable = status === 'available'

  const content = (
    <>
      <div className="game-card__top">
        <div className="game-card__badges">
          <Badge tone={categoryInfo.color}>
            <CategoryIcon size={13} aria-hidden="true" />
            {categoryInfo.label}
          </Badge>
          {beta && <Badge tone="muted">Бета</Badge>}
        </div>
        <Badge tone={locked ? 'muted' : isAvailable ? 'thinking' : 'muted'}>
          {locked ? (
            <>
              <Lock size={13} aria-hidden="true" />
              Потрібен вхід
            </>
          ) : isAvailable ? (
            <>
              <Play size={13} aria-hidden="true" />
              Грати
            </>
          ) : (
            <>
              <Clock size={13} aria-hidden="true" />
              Скоро
            </>
          )}
        </Badge>
      </div>
      <h3 className="game-card__title">{title}</h3>
      <p className="game-card__description">{description}</p>
    </>
  )

  if (locked) {
    return (
      <Link to="/login" className="game-card game-card--available game-card--locked">
        {content}
      </Link>
    )
  }

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
