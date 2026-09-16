import { test, expect } from '@playwright/test'

/*
 * Історія кладеться прямо в localStorage — так само, як її зберігає гра. Це
 * дозволяє показати сторінку прогресу в потрібному стані, не граючи двадцять
 * разів поспіль.
 */
async function seedHistory(page, entries) {
  await page.addInitScript((rows) => {
    for (const [gameId, attempts] of Object.entries(rows)) {
      localStorage.setItem(`inclusive-games:results:${gameId}`, JSON.stringify(attempts))
    }
  }, entries)
}

function attempt(date, score) {
  return { date, score, entries: [], levelId: 'classic', metrics: { total: 5 } }
}

const TODAY = new Date().toISOString().slice(0, 10)

test('замкнений значок каже, скільки лишилось', async ({ page }) => {
  await seedHistory(page, {
    simon: [
      attempt('2026-09-10T10:00:00Z', 50),
      attempt('2026-09-11T10:00:00Z', 50),
      attempt('2026-09-12T10:00:00Z', 50),
    ],
  })
  await page.goto('/progress')

  const badge = page.getByRole('progressbar', { name: /Знавець пам'яті/ })
  await expect(badge).toBeVisible()
  await expect(badge).toHaveAttribute('aria-valuenow', '3')
  await expect(badge).toHaveAttribute('aria-valuemax', '10')
})

/**
 * Здобутий значок не має показувати смужку: вона там уже нічого не каже, а
 * місце займає.
 *
 * Значок береться саме з великою ціллю: «Ідеально!» має ціль в одну спробу, і
 * смужки на ньому не буває в принципі — на такому не видно різниці.
 */
test('здобутий значок смужки не показує', async ({ page }) => {
  await seedHistory(page, {
    simon: Array.from({ length: 10 }, (_, i) =>
      attempt(`2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`, 50),
    ),
  })
  await page.goto('/progress')

  // Значок здобуто: десять спроб у «Пам'яті» — рівно його ціль.
  await expect(page.getByTitle("10 спроб у категорії «Пам'ять»")).toBeVisible()
  await expect(page.getByRole('progressbar', { name: /Знавець пам'яті/ })).toHaveCount(0)
})

test('щоденна мета показує, скільки зіграно сьогодні', async ({ page }) => {
  await seedHistory(page, {
    simon: [attempt(`${TODAY}T10:00:00Z`, 50), attempt('2026-01-01T10:00:00Z', 50)],
  })
  await page.goto('/progress')

  const goal = page.getByRole('progressbar', { name: /Мета на сьогодні/ })
  await expect(goal).toHaveAttribute('aria-valuenow', '1')
  await expect(page.getByText(/Лишилось 2 гри/)).toBeVisible()
})

test('виконана мета не вимагає грати далі', async ({ page }) => {
  await seedHistory(page, {
    simon: [
      attempt(`${TODAY}T10:00:00Z`, 50),
      attempt(`${TODAY}T11:00:00Z`, 50),
      attempt(`${TODAY}T12:00:00Z`, 50),
    ],
  })
  await page.goto('/progress')

  await expect(page.getByText(/просто так/)).toBeVisible()
})

/**
 * Учорашні ігри не мають зараховуватись у сьогоднішню мету — інакше дитина,
 * яка вчора грала багато, сьогодні бачила б виконану мету, нічого не зробивши.
 */
test('учорашні ігри в сьогоднішню мету не йдуть', async ({ page }) => {
  await seedHistory(page, {
    simon: [
      attempt('2026-01-01T10:00:00Z', 50),
      attempt('2026-01-01T11:00:00Z', 50),
      attempt('2026-01-01T12:00:00Z', 50),
    ],
  })
  await page.goto('/progress')

  const goal = page.getByRole('progressbar', { name: /Мета на сьогодні/ })
  await expect(goal).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByText(/Зіграй 3 гри/)).toBeVisible()
})
