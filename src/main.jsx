import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
/*
 * Шрифт для дислексії. Підключено лише кирилицю й латиницю, 400 і 700: браузер
 * завантажує файли шрифту тільки тоді, коли шрифт справді використано, тобто
 * лише в дитини з цим профілем.
 */
import '@fontsource/andika/cyrillic-400.css'
import '@fontsource/andika/cyrillic-700.css'
import '@fontsource/andika/latin-400.css'
import '@fontsource/andika/latin-700.css'
import './index.css'
import './styles/print.css'
import App from './App.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { registerOffline } from './lib/offline'
import { watchGlobalErrors } from './lib/errorLog'
import { warmOfflineCache } from './lib/prefetch'

// Застосунок стартував: запобіжник порожнього екрана в index.html мовчить.
window.__igBooted = true
// На дуже повільній мережі скрипт міг приїхати вже після того, як запобіжник
// показав своє повідомлення: тоді його треба прибрати.
document.getElementById('boot-fallback')?.remove()

/*
 * Шматок коду не завантажився — найчастіше тому, що вкладку відкрито до деплою,
 * а файлу зі старим ім'ям на сервері вже немає. Одне перезавантаження підтягне
 * свіжу сторінку з новими іменами. Позначка в sessionStorage не дає крутитися
 * по колу, якщо причина інша: тоді спрацює межа помилок із кнопкою.
 */
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('ig:chunk-reload') || 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('ig:chunk-reload', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

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
