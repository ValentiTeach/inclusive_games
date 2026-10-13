import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const MODERATOR = { display_name: 'Модератор', group_id: null, role: 'moderator' }

const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString()

// Найновіші спершу — так їх віддає запит з order(occurred_at desc).
const ERRORS = [
  {
    id: 3,
    occurred_at: hoursAgo(1),
    user_id: 'child-1',
    kind: 'render',
    // Довгий нерозривний текст — саме такий і розсуває сторінку на телефоні.
    message: "Cannot_read_properties_of_undefined_reading_'level'_in_SchultePlayArea_render",
    stack: 'at SchultePlayArea (schulte.js:10)',
    path: '/games/schulte',
    user_agent: 'Mozilla/5.0 (Linux; Android 13)',
    build: 'a1b2c3d',
  },
  {
    id: 2,
    occurred_at: hoursAgo(5),
    user_id: 'child-2',
    kind: 'promise',
    message: 'Failed to fetch',
    stack: null,
    path: '/progress',
    user_agent: 'Mozilla/5.0',
    build: 'a1b2c3d',
  },
  {
    id: 1,
    occurred_at: hoursAgo(30),
    user_id: 'child-2',
    kind: 'render',
    message: "Cannot_read_properties_of_undefined_reading_'level'_in_SchultePlayArea_render",
    stack: 'at SchultePlayArea (schulte.js:10)',
    path: '/games/schulte',
    user_agent: 'Mozilla/5.0',
    build: '9f8e7d6',
  },
]

const FEEDBACK = [
  {
    id: 11,
    created_at: hoursAgo(2),
    kind: 'problem',
    message: 'Після «Почати» у Шульте нічого не відбувається на планшеті.',
    contact: 'mama.oli@example.com',
    path: '/games/schulte',
    build: 'a1b2c3d',
    user_id: null,
    resolved_at: null,
  },
  {
    id: 10,
    created_at: hoursAgo(50),
    kind: 'idea',
    message: 'Додайте гру на рими.',
    contact: null,
    path: '/',
    build: '9f8e7d6',
    user_id: 'teacher-x',
    resolved_at: hoursAgo(40),
  },
]

async function openAdmin(page, posted = []) {
  await signInAsTeacher(page, {
    profile: MODERATOR,
    clientErrors: ERRORS,
    feedback: FEEDBACK,
    posted,
  })
  await page.goto('/admin')
}

test('журнал помилок групує однакові падіння і показує сторінку й версію', async ({ page }) => {
  await openAdmin(page)

  const log = page.getByRole('region', { name: 'Журнал помилок' })
  const top = log.locator('.service-log__item').first()

  await expect(top).toContainText('×2')
  await expect(top).toContainText('/games/schulte')
  await expect(top).toContainText('a1b2c3d, 9f8e7d6')
  await expect(log.locator('.service-log__item')).toHaveCount(2)

  await log.getByRole('button', { name: /Останні/ }).click()
  await expect(log.locator('tbody tr')).toHaveCount(3)
  await expect(log.locator('tbody tr').first()).toContainText('a1b2c3d')
})

test('відгуки: нерозібрані зверху, «Розібрано» пише лише позначку', async ({ page }) => {
  const posted = []
  await openAdmin(page, posted)

  const panel = page.getByRole('region', { name: /Відгуки/ })
  await expect(panel.locator('.service-log__item')).toHaveCount(1)
  await expect(panel).toContainText('mama.oli@example.com')
  await expect(panel).not.toContainText('Додайте гру на рими')

  await panel.getByRole('button', { name: 'Розібрано' }).click()
  // Розібраний відгук іде з черги, але не зникає: він серед розібраних.
  await expect(panel.locator('.service-log__item')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Показати розібрані (2)' })).toBeVisible()

  const patch = posted.find((entry) => entry.table === 'feedback' && entry.method === 'PATCH')
  expect(patch.filter).toBe('eq.11')
  expect(Object.keys(patch.payload).sort()).toEqual(['resolved_at', 'resolved_by'])

  await panel.getByRole('button', { name: /Показати розібрані/ }).click()
  await expect(panel).toContainText('Додайте гру на рими')
  await expect(panel.getByRole('button', { name: 'Повернути в роботу' })).toHaveCount(2)
})

test('журнал і відгуки вміщуються в телефон', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await openAdmin(page)
  await expect(page.locator('.service-log__item').first()).toBeVisible()

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBe(360)
})
