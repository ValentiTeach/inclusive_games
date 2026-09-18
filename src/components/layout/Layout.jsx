import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { getSettings, applySettings, watchSystemTheme } from '../../lib/settings'
import Header from './Header'
import Footer from './Footer'
import DecorativeBackground from './DecorativeBackground'
import ErrorBoundary from './ErrorBoundary'
import './Layout.css'

function Layout() {
  const location = useLocation()

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
        <main id="main-content" className="app-main">
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
