import Button from '../components/ui/Button'
import { CATEGORIES } from '../data/games'
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
      <ul className="home-hero__categories">
        {Object.entries(CATEGORIES).map(([key, category]) => (
          <li key={key}>
            <Badge tone={category.color}>{category.label}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Home
