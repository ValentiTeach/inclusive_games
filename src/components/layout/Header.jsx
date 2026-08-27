import { NavLink } from 'react-router-dom'
import { Home, Gamepad2, TrendingUp, Settings, LogIn } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import RoleBadge from '../ui/RoleBadge'
import './Header.css'

const NAV_LINKS = [
  { to: '/', label: 'Головна', end: true, icon: Home },
  { to: '/games', label: 'Каталог ігор', icon: Gamepad2 },
  { to: '/progress', label: 'Мій прогрес', icon: TrendingUp },
  { to: '/settings', label: 'Налаштування', icon: Settings },
]

function Header() {
  const { user, profile } = useAuth()
  const accountLabel = user ? (user.email ?? profile?.display_name ?? 'Акаунт') : 'Увійти'

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink to="/" className="site-header__logo">
          <img src="/logo.png" alt="" className="site-header__logo-mark" />
          <span className="site-header__logo-text">
            Inclusive Games <span className="site-header__logo-edition">| Historic_up's edition</span>
          </span>
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
              <link.icon size={16} aria-hidden="true" />
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to={user ? '/account' : '/login'}
            className={({ isActive }) =>
              isActive ? 'site-header__link site-header__account is-active' : 'site-header__link site-header__account'
            }
          >
            {!user && <LogIn size={16} aria-hidden="true" />}
            {accountLabel}
            {profile?.role && <RoleBadge role={profile.role} />}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Header
