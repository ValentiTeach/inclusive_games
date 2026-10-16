import { Link, useLocation } from 'react-router-dom'
import { LANGUAGES, setLocale, useT } from '../../i18n/i18n'
import './Footer.css'

const LINKS = [
  ['/help', 'footer.help'],
  ['/accessibility', 'footer.accessibility'],
  ['/privacy', 'footer.privacy'],
]

function Footer() {
  const year = new Date().getFullYear()
  const location = useLocation()
  const t = useT()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>{t('footer.about')}</p>
        <nav aria-label={t('footer.nav')}>
          <ul className="site-footer__links">
            {LINKS.map(([to, key]) => (
              <li key={to}>
                <Link to={to} className="site-footer__link">
                  {t(key)}
                </Link>
              </li>
            ))}
            <li>
              {/* Сторінка, з якої прийшли, — половина відповіді на «що не працює». */}
              <Link
                to="/feedback"
                state={{ from: location.pathname }}
                className="site-footer__link"
              >
                {t('footer.feedback')}
              </Link>
            </li>
          </ul>
        </nav>
        {/*
          Мова — у підвалі, а не в шапці: англійська для батьків з діаспори,
          дитині вона не потрібна, а в шапці кожен піксель уже зайнятий.
          Назва кожної мови — нею ж самою: англомовний батько не шукає
          «Англійська».
        */}
        <label className="site-footer__lang">
          <span>{t('lang.label')}</span>
          <select value={t.locale} onChange={(event) => setLocale(event.target.value)}>
            {Object.entries(LANGUAGES).map(([code, language]) => (
              <option key={code} value={code} lang={language.htmlLang}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <p>&copy; {year}</p>
      </div>
    </footer>
  )
}

export default Footer
