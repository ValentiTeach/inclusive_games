import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { getSettings, applySettings, watchSystemTheme } from '../../lib/settings'
import { usePageMeta } from '../../lib/pageMeta'
import { useT } from '../../i18n/i18n'
import Header from './Header'
import Footer from './Footer'
import DecorativeBackground from './DecorativeBackground'
import ErrorBoundary from './ErrorBoundary'
import './Layout.css'

/*
 * Сторінки, перекладені для батьків з діаспори (src/i18n). Решта — ігри,
 * довідка, юридичні сторінки, кабінет учителя — поки лише українською, і в
 * іншій мові це сказано над сторінкою, а сама сторінка позначена lang="uk":
 * інакше читач екрана читав би українське англійським голосом.
 */
const TRANSLATED_PATHS = ['/', '/login', '/child', '/feedback']

function Layout() {
  const location = useLocation()
  const t = useT()
  usePageMeta()
  const untranslated = t.locale !== 'uk' && !TRANSLATED_PATHS.includes(location.pathname)

  useEffect(() => {
    applySettings(getSettings())
    // Someone on "system" who flips their OS theme mid-session should follow
    // along without reloading.
    return watchSystemTheme(() => applySettings(getSettings()))
  }, [])

  return (
    <div className="app-shell">
      <DecorativeBackground />
      <div className="app-content">
        <a className="skip-link" href="#main-content">
          Перейти до основного контенту
        </a>
        <Header />
        {untranslated && (
          <p className="lang-notice" role="note">
            {t('lang.ukOnly')}
          </p>
        )}
        <main id="main-content" className="app-main" lang={untranslated ? 'uk' : undefined}>
          {/*
            Межа всередині розкладки, а не навколо неї: падіння однієї сторінки
            не має забирати з собою шапку — інакше дитині нема куди піти, крім
            як закрити вкладку.

            Ключ — шлях: перехід на іншу сторінку скидає межу, інакше дитина
            лишилася б на екрані помилки назавжди.
          */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default Layout
