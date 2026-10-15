import { Link } from 'react-router-dom'
import { BookA, Clock, Ear, Hand, Lock, Play, Timer } from 'lucide-react'
import Badge from './Badge'
import { CATEGORIES, NEEDS } from '../../data/games'
import { CATEGORY_ICONS } from '../../data/categoryIcons'
import './GameCard.css'

const NEED_ICONS = { hearing: Ear, reading: BookA, fineMotor: Hand, timer: Timer }

function GameCard({ id, title, category, description, status, beta, locked, needs = [] }) {
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
      {needs.length > 0 && (
        <ul className="game-card__needs" aria-label="Що потрібно для гри">
          {needs.map((key) => {
            const Icon = NEED_ICONS[key]
            return (
              <li key={key} className="game-card__need">
                <Icon size={14} aria-hidden="true" />
                {NEEDS[key].label}
              </li>
            )
          })}
        </ul>
      )}
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
