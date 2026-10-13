import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const CHILD = { id: 'child-1', display_name: 'Андрій', group_id: 'g1' }
const RESULTS = [
  { game_id: 'schulte', score: 80, metrics: { total: 5, best_rt_ms: 700 }, level_id: 'classic', played_at: '2026-09-14T10:00:00Z', entries: [] },
]

/*
 * «?» біля показника — перехід усередині застосунку. Браузер сам до якоря не
 * прокручує (сторінки довідки ще не було, коли змінилася адреса), тож це
 * робить сама довідка — і виділяє показник, заради якого прийшли.
 */
test('«?» біля показника веде до його пояснення в довідці', async ({ page }) => {
  await signInAsTeacher(page, {
    profile: { display_name: 'Мама', group_id: null, role: 'parent' },
    parentLinks: [{ student_id: CHILD.id, created_at: '2026-09-10T10:00:00Z' }],
    students: [CHILD],
    results: RESULTS,
  })
  await page.goto('/child')

  await page.getByRole('link', { name: 'Що означає «Найкращий час»' }).click()

  await expect(page).toHaveURL(/\/help#metric-best_rt_ms$/)
  const target = page.locator('#metric-best_rt_ms')
  await expect(target).toBeInViewport()
  await expect(target).toHaveClass(/is-target/)
})

test('відгук із підвалу знає, з якої сторінки прийшли', async ({ page }) => {
  const sent = []
  await page.route('**/rest/v1/feedback', async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? '{}'))
    await route.fulfill({ status: 201, body: '' })
  })

  await page.goto('/games')
  await page.getByRole('link', { name: 'Повідомити про проблему' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Повідомити про проблему чи ідею')

  await page.getByLabel(/Що сталося/).fill('Каталог не фільтрується на планшеті')
  await page.getByRole('button', { name: 'Надіслати' }).click()

  await expect(page.getByRole('heading', { name: 'Дякуємо!' })).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({
    kind: 'problem',
    message: 'Каталог не фільтрується на планшеті',
    path: '/games',
    contact: null,
    user_id: null,
  })
  expect(sent[0].build).toBeTruthy()
})

test('нові сторінки вміщуються в телефон', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  for (const path of ['/', '/help', '/accessibility', '/feedback']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth, path).toBe(360)
  }
})
