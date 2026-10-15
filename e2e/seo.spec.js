import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

/*
 * Месенджер, що складає картку посилання, бачить лише HTML — без JavaScript.
 * Тому перевіряється сирий HTML адреси, а не DOM після React.
 */
test('посилання на гру віддає HTML з її назвою й описом', async ({ request }) => {
  const html = await (await request.get('/games/schulte')).text()

  expect(html).toContain('<title>Таблиці Шульте — гра на увагу — Inclusive Games</title>')
  expect(html).toMatch(/property="og:title"\s+content="Таблиці Шульте/)
  expect(html).toMatch(/property="og:description"\s+content="Знайди числа від 1 до N/)
  expect(html).toMatch(/rel="canonical"\s+href="https:\/\/inclusive-games\.vercel\.app\/games\/schulte"/)
})

test('картинка для картки посилання існує й має розмір 1200×630', async ({ request }) => {
  const response = await request.get('/og-image.png')
  expect(response.ok()).toBe(true)
  const png = await response.body()
  // Ширина й висота PNG — у заголовку IHDR, байти 16–23.
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
})

test('robots.txt і sitemap.xml на місці', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /groups')
  expect(robots).toContain('Sitemap: https://inclusive-games.vercel.app/sitemap.xml')

  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('<loc>https://inclusive-games.vercel.app/games/stroop</loc>')
  expect(sitemap).not.toContain('/groups')
})

test('назва вкладки й canonical змінюються з переходом усередині застосунку', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Inclusive Games — когнітивні ігри для дітей')

  await page.getByRole('link', { name: 'Переглянути каталог ігор' }).click()
  await expect(page).toHaveTitle('Каталог ігор — Inclusive Games')

  await page.goto('/help')
  await page.getByRole('link', { name: 'Дані та приватність' }).first().click()
  await expect(page).toHaveTitle('Дані та приватність — Inclusive Games')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://inclusive-games.vercel.app/privacy',
  )
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('особиста сторінка просить не індексувати', async ({ page }) => {
  await signInAsTeacher(page, { groups: [] })
  await page.goto('/groups')
  await expect(page).toHaveTitle('Мої групи — Inclusive Games')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})
