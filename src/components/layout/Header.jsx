import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/authContext'
import './Header.css'

const NAV_LINKS = [
  { to: '/', label: 'Головна', end: true },
  { to: '/games', label: 'Каталог ігор' },
  { to: '/progress', label: 'Мій прогрес' },
  { to: '/settings', label: 'Налаштування' },
]

function Header() {
  const { user } = useAuth()

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink to="/" className="site-header__logo">
          Inclusive Games
        </NavLink>
        <nav className="site-header__nav" aria-label="Основна навігація">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? 'site-header__link is-active' : 'site-header__link'
              }
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/account"
            className={({ isActive }) =>
              isActive ? 'site-header__link is-active' : 'site-header__link'
            }
          >
            {user ? user.email : 'Увійти'}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Header
