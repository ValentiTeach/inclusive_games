import { NavLink } from 'react-router-dom'
import { Home, Gamepad2, TrendingUp, Settings, LogIn, Users, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import RoleBadge from '../ui/RoleBadge'
import ThemeToggle from '../ui/ThemeToggle'
import './Header.css'

const NAV_LINKS = [
  { to: '/', label: 'Головна', end: true, icon: Home },
  { to: '/games', label: 'Каталог ігор', icon: Gamepad2 },
  { to: '/progress', label: 'Мій прогрес', icon: TrendingUp },
  { to: '/settings', label: 'Налаштування', icon: Settings },
]

/**
 * Пункти, які має бачити не кожен.
 *
 * «Мої групи» — головний робочий екран вчителя, і досі він не мав у меню
 * жодного входу: потрапити туди можна було лише через сторінку акаунта. Те саме
 * з адмінкою модератора. Учневі ці сторінки не належать — і показувати їх йому
 * означало б вести його до відмови в доступі, тож список фільтрується за роллю.
 *
 * Це не заміна перевірці прав: сторінки й далі захищені RLS на боці бази.
 * Меню лише перестає ховати те, заради чого вчитель сюди заходить.
 */
const ROLE_LINKS = [
  { to: '/groups', label: 'Мої групи', icon: Users, roles: ['teacher', 'moderator'] },
  { to: '/admin', label: 'Адмінка', icon: ShieldCheck, roles: ['moderator'] },
]

function Header() {
  const { user, profile } = useAuth()
  /*
   * Ім'я, а не пошта. Пошта — це логін, а не те, як учителька себе називає, і в
   * меню вона з'їдала близько 180 px: із рольовими пунктами шапка через неї не
   * вміщалася в один ряд узагалі. Повна адреса лишається на сторінці акаунта і
   * в title цього ж посилання.
   */
  const accountLabel = user ? (profile?.display_name ?? user.email ?? 'Акаунт') : 'Увійти'
  const links = [...NAV_LINKS, ...ROLE_LINKS.filter((link) => link.roles.includes(profile?.role))]
  /* Щільна шапка — це не ширина екрана, а кількість пунктів: у вчителя їх
     шість, у модератора сім, і там, де учневі просторо, їм уже тісно. CSS не
     вміє рахувати елементи, тож рахунок тут, а пороги — у Header.css. */
  const isDense = links.length > NAV_LINKS.length

  return (
    <header className={isDense ? 'site-header site-header--dense' : 'site-header'}>
      <div className="site-header__inner">
        <NavLink to="/" className="site-header__logo">
          <img src="/logo.png" alt="" className="site-header__logo-mark" />
          <span className="site-header__logo-text">
            Inclusive Games <span className="site-header__logo-edition">| Historic_up's edition</span>
          </span>
        </NavLink>
        <nav className="site-header__nav" aria-label="Основна навігація">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? 'site-header__link is-active' : 'site-header__link'
              }
            >
              <link.icon size={18} aria-hidden="true" />
              <span className="site-header__link-label">{link.label}</span>
            </NavLink>
          ))}
          <NavLink
            to={user ? '/account' : '/login'}
            className={({ isActive }) =>
              isActive ? 'site-header__link site-header__account is-active' : 'site-header__link site-header__account'
            }
          >
            {!user && <LogIn size={18} aria-hidden="true" />}
            <span className="site-header__account-label" title={accountLabel}>
              {accountLabel}
            </span>
            {profile?.role && <RoleBadge role={profile.role} />}
          </NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

export default Header
