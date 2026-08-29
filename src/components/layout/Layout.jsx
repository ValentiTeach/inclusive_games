import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { getSettings, applySettings } from '../../lib/settings'
import Header from './Header'
import Footer from './Footer'
import DecorativeBackground from './DecorativeBackground'
import MotionDebugBanner from './MotionDebugBanner'
import './Layout.css'

function Layout() {
  useEffect(() => {
    applySettings(getSettings())
  }, [])

  return (
    <div className="app-shell">
      <MotionDebugBanner />
      <DecorativeBackground />
      <div className="app-content">
        <a className="skip-link" href="#main-content">
          Перейти до основного контенту
        </a>
        <Header />
        <main id="main-content" className="app-main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default Layout
