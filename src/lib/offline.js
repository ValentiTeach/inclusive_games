/**
 * Реєстрація service worker.
 *
 * Тільки у зібраному застосунку. У розробці й у тестах він шкодить більше, ніж
 * допомагає: закешована сторінка переживає перезбирання, і зміни, які щойно
 * зроблено, не видно — а причину цього шукають годинами.
 */
export function registerOffline() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Офлайн — приємне доповнення, а не умова роботи. Браузер, який
      // відмовив (приватне вікно, вимкнені worker'и), має просто працювати
      // далі через мережу.
    })
  })
}
