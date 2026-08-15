import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import './Layout.css'

function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Перейти до основного контенту
      </a>
      <Header />
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default Layout
