import { preloadAllPages } from '../routes'

/*
 * Прогрів кешу під офлайн.
 *
 * Розділення коду має ціну, яку легко не помітити: service worker кешує лише
 * те, що вже хоч раз запитали. Дитина, яка встановила застосунок і поїхала
 * туди, де немає мережі, досі отримувала всі ігри — вони лежали в одному
 * шматку. Тепер шматок гри, у яку вона ще не грала, просто не існує в кеші, і
 * офлайн вона побачить помилку замість гри.
 *
 * Тож після першого малювання, на простої, шматки замовляються наперед. Це не
 * скасовує виграшу від розділення: значення має те, що потрібно показати
 * перший екран, а не те, що приїде згодом фоном.
 */

// Дає браузеру домалювати й заспокоїтися. requestIdleCallback є не всюди —
// Safari донедавна його не мав, а на телефонах у школі Safari не рідкість.
const whenIdle =
  typeof requestIdleCallback === 'function'
    ? (fn) => requestIdleCallback(fn, { timeout: 5000 })
    : (fn) => setTimeout(fn, 2000)

export function warmOfflineCache() {
  // Без service worker прогрівати нічого: офлайну однаково не буде, а трафік
  // витратиться намарно. Це ж відсікає розробку й тести.
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

  // На першому візиті controller порожній: воркер ще встановлюється і перехопить
  // сторінку лише через clients.claim(). Саме перший візит найважливіший — це
  // єдина мить, коли мережа точно є. Тож чекаємо на перехоплення, а не мовчимо.
  if (!navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => warmOfflineCache(), {
      once: true,
    })
    return
  }

  // Режим економії трафіку і повільна мережа — чужі гроші. Дитина, яка сидить
  // на мобільному інтернеті з лімітом, не має качати дев'ятнадцять ігор заради
  // офлайну, якого не просила.
  const connection = navigator.connection
  if (connection?.saveData) return
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return

  whenIdle(() => {
    preloadAllPages()
    // Реєстр ігор запитується теж динамічно, і це не примха: він тягне за собою
    // конфіги всіх дев'ятнадцяти ігор. Статичний імпорт тут повертав би їх у
    // початковий шматок — тобто прогрів скасовував би те, заради чого код і
    // ділили. Перевірено на збірці: 253 кБ проти 292 кБ.
    void import('../games/registry')
      .then((module) => module.preloadAllPlayAreas())
      .catch(() => {})
  })
}
