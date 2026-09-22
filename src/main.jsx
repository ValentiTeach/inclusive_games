import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/print.css'
import App from './App.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { registerOffline } from './lib/offline'
import { watchGlobalErrors } from './lib/errorLog'
import { warmOfflineCache } from './lib/prefetch'

/*
 * Зовнішня межа — остання лінія. Вона ловить те, що впало поза сторінкою:
 * у самій шапці, у маршрутизаторі, у розкладці. Внутрішня межа стоїть у
 * Layout навколо сторінки й лишає дитині шапку, щоб було куди піти.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

/*
 * Межа React не бачить помилок поза малюванням: у таймері, в обробнику події,
 * в обіцянці без catch. Їх ловлять глобальні слухачі.
 */
watchGlobalErrors()
warmOfflineCache()
registerOffline()
