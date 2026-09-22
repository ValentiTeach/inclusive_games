import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const preloadAllPages = vi.fn()
const preloadAllPlayAreas = vi.fn()

vi.mock('../routes', () => ({ preloadAllPages: () => preloadAllPages() }))
vi.mock('../games/registry', () => ({ preloadAllPlayAreas: () => preloadAllPlayAreas() }))

const { warmOfflineCache } = await import('./prefetch')

/**
 * Підміняє navigator.serviceWorker і connection.
 * @param options.controller чи вже перехопив воркер цю сторінку
 * @param options.connection що каже navigator.connection (undefined — його немає)
 */
function stubNavigator({ hasServiceWorker = true, controller = true, connection } = {}) {
  const listeners = {}
  const serviceWorker = {
    controller: controller ? {} : null,
    addEventListener: (type, handler) => {
      listeners[type] = handler
    },
  }

  vi.stubGlobal('navigator', {
    ...(hasServiceWorker ? { serviceWorker } : {}),
    ...(connection ? { connection } : {}),
  })

  return {
    listeners,
    /** Імітує мить, коли воркер перехопив сторінку. */
    takeControl() {
      serviceWorker.controller = {}
      listeners.controllerchange?.()
    },
  }
}

describe('прогрів кешу під офлайн', () => {
  beforeEach(() => {
    preloadAllPages.mockClear()
    preloadAllPlayAreas.mockClear()
    // requestIdleCallback у jsdom немає — лишається гілка з setTimeout.
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // runAllTimersAsync, а не runAllTimers: ігровий реєстр запитується динамічним
  // імпортом, і без прокрутки мікрозадач його виклик не встиг би відбутися.
  async function runIdle() {
    await vi.runAllTimersAsync()
  }

  it('замовляє сторінки та ігри, коли воркер уже керує сторінкою', async () => {
    stubNavigator()
    warmOfflineCache()

    // До простою нічого не качається: перший екран має домалюватися першим.
    expect(preloadAllPages).not.toHaveBeenCalled()

    await runIdle()
    expect(preloadAllPages).toHaveBeenCalledTimes(1)
    expect(preloadAllPlayAreas).toHaveBeenCalledTimes(1)
  })

  it('мовчить, коли service worker недоступний', async () => {
    stubNavigator({ hasServiceWorker: false })
    warmOfflineCache()
    await runIdle()

    expect(preloadAllPages).not.toHaveBeenCalled()
    expect(preloadAllPlayAreas).not.toHaveBeenCalled()
  })

  it('чекає, поки воркер перехопить сторінку, і аж тоді гріє', async () => {
    const nav = stubNavigator({ controller: false })
    warmOfflineCache()
    await runIdle()

    // Найперший візит: воркер ще ставиться, гріти нічим.
    expect(preloadAllPages).not.toHaveBeenCalled()

    nav.takeControl()
    await runIdle()
    expect(preloadAllPages).toHaveBeenCalledTimes(1)
    expect(preloadAllPlayAreas).toHaveBeenCalledTimes(1)
  })

  it('не витрачає чужий трафік у режимі економії', async () => {
    stubNavigator({ connection: { saveData: true, effectiveType: '4g' } })
    warmOfflineCache()
    await runIdle()

    expect(preloadAllPages).not.toHaveBeenCalled()
  })

  it('не гріє на 2g', async () => {
    stubNavigator({ connection: { saveData: false, effectiveType: 'slow-2g' } })
    warmOfflineCache()
    await runIdle()

    expect(preloadAllPages).not.toHaveBeenCalled()
  })

  it('гріє на 3g і швидших — повільна мережа це ще не економія', async () => {
    stubNavigator({ connection: { saveData: false, effectiveType: '3g' } })
    warmOfflineCache()
    await runIdle()

    expect(preloadAllPages).toHaveBeenCalledTimes(1)
  })
})
