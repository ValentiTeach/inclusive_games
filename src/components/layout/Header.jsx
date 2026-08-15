import { NavLink } from 'react-router-dom'
import './Header.css'

function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink to="/" className="site-header__logo">
          Inclusive Games
        </NavLink>
        <nav className="site-header__nav" aria-label="Основна навігація">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'site-header__link is-active' : 'site-header__link'
            }
          >
            Головна
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) =>
              isActive ? 'site-header__link is-active' : 'site-header__link'
            }
          >
            Каталог ігор
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Header
