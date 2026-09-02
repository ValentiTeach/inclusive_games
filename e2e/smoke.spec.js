import { test, expect } from '@playwright/test'

// These run against the built app with no Supabase credentials, so they cover
// exactly the parts a visitor sees before signing in — which is also the part
// that has to render identically across browsers.

test('home page renders its hero and lets you reach the catalogue', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByRole('link', { name: 'Переглянути каталог ігор' }).click()
  await expect(page).toHaveURL(/\/games/)
})

test('catalogue lists every game and opens a free one', async ({ page }) => {
  await page.goto('/games')

  await expect(page.locator('.game-card')).toHaveCount(12)

  const playable = page.locator('a.game-card[href^="/games/"]')
  await expect(playable.first()).toBeVisible()

  await playable.first().click()
  await expect(page).toHaveURL(/\/games\/.+/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// Guest gating is business logic, not decoration: a signed-out visitor can play
// the three sample games, and every other card sends them to sign in instead of
// opening the game.
test('locked games send a signed-out visitor to the login page', async ({ page }) => {
  await page.goto('/games')

  await expect(page.locator('a.game-card[href^="/games/"]')).toHaveCount(3)

  const locked = page.locator('a.game-card--locked')
  await expect(locked).toHaveCount(9)
  await expect(page.getByText('Потрібен вхід')).toHaveCount(9)

  await locked.first().click()
  await expect(page).toHaveURL(/\/login/)
})

test('login page offers both the student and the teacher route', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByText('Я учень')).toBeVisible()
  await expect(page.getByText('Я вчитель / психолог')).toBeVisible()
})

test('unknown routes land on the not-found page rather than a blank screen', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('Сторінку не знайдено')).toBeVisible()
})

// Guards the layout invariant behind an earlier bug: .app-shell and
// .app-content each need a real minimum height, or the footer rides up and the
// decorative layer stops covering the viewport. A browser that ignores the svh
// unit must still get a height from the vh fallback.
test('app shell fills the viewport height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  for (const selector of ['.app-shell', '.app-content']) {
    const height = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().height)
    expect(height, `${selector} should fill the viewport`).toBeGreaterThanOrEqual(880)
  }
})

test('page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflows).toBe(false)
})
