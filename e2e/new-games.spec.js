import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'
import { GAMES as CATALOG } from '../src/data/games.js'

/*
 * Десять ігор нових напрямів — у справжньому браузері, з тим самим підмінним
 * входом, що й решта ігор за авторизацією.
 *
 * Для кожної перевіряється одне, але головне: гра доходить до результату, і
 * спроба їде на сервер із правильним game_id. Гра, яка малюється, але нічого не
 * записує, — найтихіша поломка з можливих: дитина грала, вчитель не бачить.
 *
 * Більшість ігор проходяться випадковими натисканнями: неправильна відповідь
 * теж відповідь, і гра однаково має дійти до кінця. Доріжку ведемо мишею по
 * справжній центральній лінії — випадкові кліки її ніколи б не пройшли.
 */

const TEST_TIMEOUT_MS = 120_000

const GAMES = [
  { id: 'day-night', options: '.day-night__answer' },
  { id: 'card-sort', options: '.card-sort__target' },
  { id: 'first-sound', options: '.first-sound__option' },
  { id: 'word-groups', options: '.word-groups__bin, .word-groups__odd-item' },
  { id: 'emotions', options: '.emotions__option' },
  { id: 'number-line', options: '.number-line__line' },
  { id: 'tower', options: '.tower__work .tower__peg', delay: 60 },
  { id: 'graphic-dictation', options: '.dictation__key', delay: 40 },
  { id: 'rhythm', options: '.rhythm__drum', delay: 250 },
  { id: 'trace-path', trace: true },
]

async function start(page, gameId) {
  await page.goto(`/games/${gameId}`)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
}

const results = (page) => page.getByRole('heading', { name: 'Результат' })

async function clickThrough(page, selector, delay = 200, timeoutMs = 100_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await results(page).isVisible().catch(() => false)) return true
    const options = page.locator(selector)
    const count = await options.count()
    if (count > 0) {
      const index = Math.floor(Math.random() * count)
      const option = options.nth(index)
      const box = await option.boundingBox().catch(() => null)
      if (box) {
        // Клік у випадкову точку елемента: на числовій прямій це і є відповідь.
        // Через локатор, а не page.mouse: він сам прокручує до елемента, а
        // кнопки гри на вікні 1280×720 бувають нижче краю.
        await option
          .click({
            position: { x: box.width * (0.1 + Math.random() * 0.8), y: box.height / 2 },
            timeout: 1000,
          })
          .catch(() => {})
      }
    }
    await page.waitForTimeout(delay)
  }
  return false
}

/** Веде мишею по центральній лінії кожної доріжки, поки не з'явиться результат. */
async function traceThrough(page, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await results(page).isVisible().catch(() => false)) return true
    const guide = page.locator('.trace__guide')
    if (!(await guide.isVisible().catch(() => false))) {
      await page.waitForTimeout(200)
      continue
    }
    await page.locator('.trace__field').scrollIntoViewIfNeeded()
    const box = await page.locator('.trace__field').boundingBox()
    const points = (await guide.getAttribute('points'))
      .trim()
      .split(' ')
      .map((pair) => pair.split(',').map(Number))
    const toScreen = ([x, y]) => [box.x + (x / 600) * box.width, box.y + (y / 300) * box.height]

    await page.mouse.move(...toScreen(points[0]))
    await page.mouse.down()
    for (let i = 0; i < points.length; i += 4) await page.mouse.move(...toScreen(points[i]))
    await page.mouse.move(...toScreen(points.at(-1)))
    await page.mouse.up()
    await page.waitForTimeout(1200)
  }
  return false
}

for (const game of GAMES) {
  test(`${game.id}: гра доходить до результату і спроба їде на сервер`, async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    await signInAsTeacher(page, { groups: [] })

    const saved = []
    await page.route('**/rest/v1/results*', async (route) => {
      if (route.request().method() === 'POST') {
        saved.push(JSON.parse(route.request().postData() ?? '{}'))
      }
      await route.fallback()
    })

    await start(page, game.id)
    const finished = game.trace
      ? await traceThrough(page)
      : await clickThrough(page, game.options, game.delay)
    expect(finished).toBe(true)

    await expect.poll(() => saved.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(saved[0].game_id).toBe(game.id)
    expect(typeof saved[0].score).toBe('number')
    expect(saved[0].metrics).toBeTruthy()
  })
}

test('доріжка, пройдена по центру, — це 100% у межах', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await page.goto('/games/trace-path')
  await signInAsTeacher(page, { groups: [] })
  await start(page, 'trace-path')
  expect(await traceThrough(page)).toBe(true)

  const [attempt] = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('inclusive-games:results:trace-path') ?? '[]'),
  )
  expect(attempt.metrics.inside_pct).toBe(100)
  expect(attempt.metrics.exits).toBe(0)
})

test('нові навички відфільтровуються в каталозі', async ({ page }) => {
  // Кількість — з даних, а не числом: інакше кожна нова гра ламала б тест.
  for (const category of ['speech', 'space', 'regulation']) {
    await page.goto(`/games?category=${category}`)
    await expect(page.locator('.game-card')).toHaveCount(
      CATALOG.filter((game) => game.category === category).length,
    )
  }
})

test('сторінка про дані дітей доступна з підвалу', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Дані та приватність' }).click()
  await expect(page.getByRole('heading', { name: 'Дані та приватність' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Як видалити дані дитини' })).toBeVisible()
})
