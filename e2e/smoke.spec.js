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

// The viewport-height test above can't catch a missing fallback: it runs in a
// browser that understands svh, so the page looks right either way. This one
// inspects the shipped stylesheet instead — the minifier once dropped the vh
// fallback as a "duplicate min-height", and only the built artifact shows it.
test('shipped stylesheet keeps a viewport-height fallback for old browsers', async ({
  page,
  request,
}) => {
  await page.goto('/')

  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href')
  expect(href).toBeTruthy()

  const css = await (await request.get(href)).text()

  expect(css, 'plain vh fallback must survive minification').toMatch(
    /\.app-shell\{[^}]*min-height:100vh/,
  )
  expect(css, 'svh upgrade must stay behind @supports').toMatch(
    /@supports\s*\(height:\s*100svh\)/,
  )
})

// The unit tests assert the data-theme attribute, which would still pass if the
// CSS selector behind it were misspelled. These check the colour actually
// painted, so the whole chain — click, attribute, tokens, paint — is covered.
test.describe('theme switch', () => {
  const bodyBackground = (page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  test('follows a dark system by default and can be overridden both ways', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/settings')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const systemDark = await bodyBackground(page)

    await page.getByRole('button', { name: 'Світла', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const forcedLight = await bodyBackground(page)
    expect(forcedLight).not.toBe(systemDark)

    await page.getByRole('button', { name: 'Темна', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await bodyBackground(page)).toBe(systemDark)
  })

  test('the header button flips the theme from any page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const before = await bodyBackground(page)
    await page.getByRole('button', { name: 'Увімкнути світлу тему' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bodyBackground(page)).not.toBe(before)

    // The icon swaps to offer the opposite direction.
    await expect(page.getByRole('button', { name: 'Увімкнути темну тему' })).toBeVisible()
  })

  test('keeps the chosen theme across a reload, with no light flash on the way', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Темна', exact: true }).click()

    await page.reload()

    // Set by the inline script in index.html, before the bundle even parses.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test('page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflows).toBe(false)
})
