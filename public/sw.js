/*
 * Власний service worker, без workbox.
 *
 * Причина проста: майже весь застосунок і так працює без мережі — ігри
 * рахуються на клієнті, історія лежить у localStorage. Бракувало тільки того,
 * щоб браузер мав із чого підняти сторінку, коли зв'язку немає. Для цього
 * достатньо кількох десятків рядків, які видно цілком, а не шару генерації з
 * власними домовленостями.
 *
 * Стратегії дві, і обидві обрані під конкретну загрозу:
 *
 * - Перехід на сторінку (navigate) — спершу мережа, потім кеш. Так дитина
 *   завжди отримує свіжий index.html із посиланнями на новий бандл, а якщо
 *   мережі немає — торішній, але робочий.
 * - Файли застосунку — спершу кеш. Їхні імена містять хеш вмісту, тож стара
 *   назва завжди означає старий вміст: перевіряти мережу не має сенсу.
 *
 * Чого кеш ніколи не бере: відповідь, що не схожа на файл, який просили. Хостинг
 * віддає index.html на будь-яку невідому адресу, і досі шматок коду, якого вже
 * немає після нового деплою, міг осісти в кеші як HTML під ім'ям .js —
 * назавжди. Браузер такий «скрипт» не виконує, і сайт лишався порожнім екраном.
 * Версія v2 стирає всі кеші v1 при активації, тож зіпсований кеш на пристроях,
 * де він уже є, зникає сам.
 *
 * Чого тут навмисно немає: кешування запитів до Supabase. Результати дитини —
 * не те, що можна показати застарілими, а спроба «синхронізувати потім» без
 * розв'язання конфліктів зіпсувала б дані. Офлайн гра зберігається локально і
 * вивантажується при наступному вході — цей шлях уже існує (cloudSync).
 */

const VERSION = 'v2'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`

// Мінімум, щоб підняти застосунок: сама сторінка та іконки. Решта потрапляє в
// кеш тоді, коли її вперше запитали.
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // addAll падає цілком, якщо хоч один файл не завантажився, і тоді
      // встановлення зривається. Тут це зайва суворість: іконка, якої немає,
      // не привід лишати дитину без офлайну.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Чужі домени — не наша справа: ні Supabase, ні аналітика сюди не потрапляють.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Лише справжня сторінка: помилка сервера, покладена в кеш як «/»,
          // віддавалася б потім і без мережі.
          if (response.ok && isType(response, 'text/html')) {
            const copy = response.clone()
            caches.open(SHELL).then((cache) => cache.put('/', copy))
          }
          return response
        })
        // Будь-який перехід у застосунку віддаємо з тієї самої збереженої
        // сторінки: маршрутизація в ньому клієнтська, і /games так само
        // піднімається з index.html, як і корінь.
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        // Кешуємо лише те, що справді віддалося: помилка 404, покладена в кеш,
        // лишилася б там назавжди.
        if (response.ok && response.type === 'basic' && matchesRequest(url, response)) {
          const copy = response.clone()
          caches.open(ASSETS).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

function isType(response, type) {
  return (response.headers.get('content-type') || '').includes(type)
}

/*
 * Чи відповідь — той самий тип файлу, що й запит. Головне тут — не покласти
 * HTML під ім'ям .js чи .css: саме так виглядає «файлу вже немає» на хостингу,
 * що на все невідоме віддає index.html.
 */
function matchesRequest(url, response) {
  if (/\.(m?js|css)$/.test(url.pathname)) return !isType(response, 'text/html')
  return true
}
