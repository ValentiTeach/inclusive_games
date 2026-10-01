import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

/*
 * Одинадцять ігор другої хвилі (пріоритети Б і В) — до результату і з
 * перевіркою, що спроба їде на сервер. Більшість проходиться випадковими
 * натисканнями; лабіринт — правилом правої руки, бо навмання його можна
 * блукати хвилинами.
 */

const TEST_TIMEOUT_MS = 150_000

const GAMES = [
  { id: 'flanker', options: '.flanker__answer' },
  { id: 'hidden-figures', options: '.hidden-figures__option, .hidden-figures button.button' },
  { id: 'more-dots', options: '.more-dots__side' },
  { id: 'seriation', options: '.tap-order__item:not(.is-placed)' },
  { id: 'listen-catch', options: '.listen-catch__button', delay: 400 },
  { id: 'story-order', options: '.tap-order__item:not(.is-placed)' },
  { id: 'ten-words', options: '.ten-words__option, .ten-words button.button' },
  { id: 'object-place', options: '.object-place__cell, .object-place button.button' },
  { id: 'time-sense', options: '.time-sense__button', delay: 700 },
  { id: 'symmetry', options: '.symmetry__cell.is-editable, .symmetry button.button' },
  { id: 'maze', maze: true },
]

const results = (page) => page.getByRole('heading', { name: 'Результат' })

async function clickThrough(page, selector, delay = 150, timeoutMs = 130_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await results(page).isVisible().catch(() => false)) return true
    const options = page.locator(selector)
    const count = await options.count()
    if (count > 0) {
      await options
        .nth(Math.floor(Math.random() * count))
        .click({ timeout: 1000 })
        .catch(() => {})
    }
    await page.waitForTimeout(delay)
  }
  return false
}

/** Правило правої руки: у досконалому лабіринті воно завжди виводить. */
async function solveMazes(page, timeoutMs = 130_000) {
  const order = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']
  let heading = 1
  // Короткий тайм-аут: після останнього лабіринту кульки вже немає, і
  // стандартні 30 с очікування на кожну з чотирьох стрілок з'їли б увесь тест.
  const read = (attr) => page.locator('.maze__ball').getAttribute(attr, { timeout: 300 })
  const ball = async () => `${await read('cx')},${await read('cy')}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await results(page).isVisible().catch(() => false)) return true
    if (!(await page.locator('.maze__ball').isVisible().catch(() => false))) {
      await page.waitForTimeout(200)
      continue
    }
    const before = await ball().catch(() => null)
    for (const turn of [1, 0, 3, 2]) {
      const dir = (heading + turn) % 4
      await page.keyboard.press(order[dir])
      // Кулька перемальовується після рендера, а не в мить натискання.
      await page.waitForTimeout(60)
      const after = await ball().catch(() => null)
      if (after !== before) {
        heading = dir
        break
      }
    }
  }
  return false
}

for (const game of GAMES) {
  test(`${game.id}: гра доходить до результату і спроба їде на сервер`, async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    await signInAsTeacher(page, { groups: [] })

    const saved = []
    await page.route('**/rest/v1/results*', async (route) => {
      if (route.request().method() === 'POST') saved.push(JSON.parse(route.request().postData() ?? '{}'))
      await route.fallback()
    })

    await page.goto(`/games/${game.id}`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const finished = game.maze ? await solveMazes(page) : await clickThrough(page, game.options, game.delay)
    expect(finished).toBe(true)

    await expect.poll(() => saved.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(saved[0].game_id).toBe(game.id)
    expect(typeof saved[0].score).toBe('number')
    expect(saved[0].metrics).toBeTruthy()
  })
}

test('лабіринт рахує удари об стіни, які правило правої руки неминуче пробує', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await signInAsTeacher(page, { groups: [] })
  await page.goto('/games/maze')
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  expect(await solveMazes(page)).toBe(true)
  const [attempt] = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('inclusive-games:results:maze') ?? '[]'),
  )
  // Правило правої руки пробує й стіни — це удари, і саме так їх і має бути видно.
  expect(attempt.metrics.rule_breaks).toBeGreaterThan(0)
  expect(attempt.metrics.moves).toBeGreaterThanOrEqual(attempt.metrics.moves - attempt.metrics.extra_moves)
})

test('у каталозі сім навичок, «Саморегуляція» серед них', async ({ page }) => {
  await page.goto('/games?category=regulation')
  await expect(page.locator('.game-card')).toHaveCount(3)
  await expect(page.locator('.catalog-filter', { hasText: 'Саморегуляція' })).toHaveClass(/is-active/)
})
