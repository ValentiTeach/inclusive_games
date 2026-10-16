import { NavLink } from 'react-router-dom'
import {
  Home,
  Gamepad2,
  TrendingUp,
  Settings,
  LogIn,
  Users,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { usePendingParentRequests } from '../../lib/usePendingParentRequests'
import RoleBadge from '../ui/RoleBadge'
import ThemeToggle from '../ui/ThemeToggle'
import { useT } from '../../i18n/i18n'
import './Header.css'

const LOGO_NAME = 'Inclusive Games'

const NAV_LINKS = [
  { to: '/', label: 'nav.home', end: true, icon: Home },
  { to: '/games', label: 'nav.games', icon: Gamepad2 },
  { to: '/progress', label: 'nav.progress', icon: TrendingUp },
  { to: '/settings', label: 'nav.settings', icon: Settings },
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
  { to: '/child', label: 'nav.child', icon: HeartHandshake, roles: ['parent'] },
  { to: '/groups', label: 'nav.groups', icon: Users, roles: ['teacher', 'moderator'] },
  { to: '/admin', label: 'nav.admin', icon: ShieldCheck, roles: ['moderator'] },
]

function Header() {
  const { user, profile } = useAuth()
  const t = useT()
  /*
   * Ім'я, а не пошта. Пошта — це логін, а не те, як учителька себе називає, і в
   * меню вона з'їдала близько 180 px: із рольовими пунктами шапка через неї не
   * вміщалася в один ряд узагалі. Повна адреса лишається на сторінці акаунта і
   * в title цього ж посилання.
   */
  const accountLabel = user ? (profile?.display_name ?? user.email ?? t('nav.account')) : t('nav.signIn')
  const links = [...NAV_LINKS, ...ROLE_LINKS.filter((link) => link.roles.includes(profile?.role))]
  /* Щільна шапка — це не ширина екрана, а кількість пунктів: у вчителя їх
     шість, у модератора сім, і там, де учневі просторо, їм уже тісно. CSS не
     вміє рахувати елементи, тож рахунок тут, а пороги — у Header.css. */
  const isDense = links.length > NAV_LINKS.length
  /* Заявки батьків чекають лише на модератора — йому лічильник і потрібен. */
  const pendingRequests = usePendingParentRequests(profile?.role === 'moderator')

  return (
    <header className={isDense ? 'site-header site-header--dense' : 'site-header'}>
      <div className="site-header__inner">
        <NavLink to="/" className="site-header__logo">
          <img src="/logo.png" alt="" className="site-header__logo-mark" />
          <span className="site-header__logo-text">
            <span className="site-header__logo-name">
              {/* Літери по одній — щоб кожна мала свій колір. Читачеві екрана
                  така назва звучала б по буквах, тож він чує цілу назву окремо. */}
              <span className="visually-hidden">{LOGO_NAME}</span>
              <span className="site-header__logo-letters" aria-hidden="true">
                {[...LOGO_NAME].map((char, index) =>
                  char === ' ' ? (
                    <span key={index} className="site-header__logo-gap" />
                  ) : (
                    <span
                      key={index}
                      className="site-header__logo-letter"
                      style={{ '--letter-index': index }}
                    >
                      {char}
                    </span>
                  ),
                )}
              </span>
            </span>
            <span className="site-header__logo-edition">| Historic_up&apos;s edition</span>
          </span>
        </NavLink>
        <nav className="site-header__nav" aria-label={t('nav.main')}>
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
              <span className="site-header__link-label">{t(link.label)}</span>
              {link.to === '/admin' && pendingRequests > 0 && (
                <>
                  <span className="site-header__badge" aria-hidden="true">
                    {pendingRequests}
                  </span>
                  <span className="visually-hidden">
                    {t('nav.pendingRequests', { count: pendingRequests })}
                  </span>
                </>
              )}
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
