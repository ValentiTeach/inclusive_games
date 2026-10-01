import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>Inclusive Games — платформа когнітивних міні-ігор для дітей.</p>
        <p>
          <Link to="/privacy" className="site-footer__link">
            Дані та приватність
          </Link>
        </p>
        <p>&copy; {year}</p>
      </div>
    </footer>
  )
}

export default Footer
