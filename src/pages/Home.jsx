import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import { CATEGORIES } from '../data/games'
import { CATEGORY_ICONS } from '../data/categoryIcons'
import Badge from '../components/ui/Badge'
import './Home.css'

function Home() {
  return (
    <section className="home-hero">
      <h1>Ігри, що тренують увагу, пам’ять і мислення</h1>
      <p className="home-hero__lede">
        Короткі інтерактивні вправи для дітей: увага, пам’ять, логіка та швидкість
        реакції. Кожна гра — окрема вправа на пару хвилин, зручна для уроку чи
        домашнього тренування.
      </p>
      <div className="home-hero__actions">
        <Button to="/games">Переглянути каталог ігор</Button>
      </div>

      {/* Раніше це були просто написи — чотири слова, які виглядали як кнопки,
          але нічого не робили. Тепер кожне веде до ігор саме на цей навик. */}
      <p className="home-hero__categories-label">Обери навик:</p>
      <ul className="home-hero__categories">
        {Object.entries(CATEGORIES).map(([key, category]) => {
          const Icon = CATEGORY_ICONS[key]
          return (
            <li key={key}>
              <Link to={`/games?category=${key}`} className="home-hero__category">
                <Badge tone={category.color}>
                  <Icon size={13} aria-hidden="true" />
                  {category.label}
                </Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default Home
