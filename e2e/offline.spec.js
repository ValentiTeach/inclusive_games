import { test, expect } from '@playwright/test'

/**
 * Офлайн.
 *
 * Майже весь застосунок і так рахується на клієнті — ігри не ходять у мережу, а
 * історія лежить у localStorage. Бракувало тільки того, щоб браузер мав із чого
 * підняти сторінку, коли зв'язку немає: на шкільному Wi-Fi і в дорозі це
 * різниця між «грає» і «біла сторінка».
 *
 * Тести ганяють справжній service worker у справжньому браузері з вимкненою
 * мережею — інакше перевірялося б лише те, що файл існує.
 */
test.describe('робота без мережі', () => {
  test('сторінка має маніфест і реєструє service worker', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    )

    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return Boolean(registration)
    })
    expect(registered, 'service worker мав зареєструватися').toBe(true)
  })

  test('маніфест описує застосунок, який можна встановити', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest')
    const manifest = await response.json()

    expect(manifest.name).toContain('Inclusive Games')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    // Без іконки 512×512 встановлення пропонують не всі браузери.
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true)
    // Maskable потрібна, щоб на Android іконку не обрізало по квадрату.
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  /**
   * Головна перевірка: мережу вимкнено повністю, і сторінка все одно
   * піднімається.
   */
  test('після першого відкриття сторінка працює без мережі', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // Один повний прохід мережею, щоб файли потрапили в кеш.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.site-header__nav')).toBeVisible()
  })

  /**
   * Маршрутизація в застосунку клієнтська, тож /games так само піднімається з
   * index.html, як і корінь. Без цього правила будь-яка адреса, крім «/», в
   * офлайні давала б помилку.
   */
  test('офлайн відкривається не лише коренева адреса', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()

    await context.setOffline(true)
    await page.goto('/games')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.game-card').first()).toBeVisible()
  })

  /**
   * Гра має не просто відкритися, а зігратися: у цьому й сенс офлайну для
   * дитини в дорозі.
   */
  test('офлайн можна зіграти в гру і побачити результат', async ({ page, context }) => {
    await page.goto('/games/catch-the-moment')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()

    await context.setOffline(true)
    await page.reload()

    await page.getByText('Почати', { exact: true }).first().click()
    await expect(page.locator('.catch__track')).toBeVisible({ timeout: 10000 })

    for (let round = 0; round < 6; round++) {
      await page.keyboard.press('Space')
      await expect(page.locator('.catch__marker.is-stopped')).toBeVisible()
      await page.waitForTimeout(800)
    }

    await expect(page.getByText('Влучань')).toBeVisible()
  })
})
