import { Link, useLocation } from 'react-router-dom'
import './Footer.css'

const LINKS = [
  ['/help', 'Довідка'],
  ['/accessibility', 'Доступність'],
  ['/privacy', 'Дані та приватність'],
]

function Footer() {
  const year = new Date().getFullYear()
  const location = useLocation()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>Inclusive Games — платформа когнітивних міні-ігор для дітей.</p>
        <nav aria-label="Довідка й зворотний зв’язок">
          <ul className="site-footer__links">
            {LINKS.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="site-footer__link">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              {/* Сторінка, з якої прийшли, — половина відповіді на «що не працює». */}
              <Link
                to="/feedback"
                state={{ from: location.pathname }}
                className="site-footer__link"
              >
                Повідомити про проблему
              </Link>
            </li>
          </ul>
        </nav>
        <p>&copy; {year}</p>
      </div>
    </footer>
  )
}

export default Footer
