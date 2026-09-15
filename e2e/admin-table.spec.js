import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const USERS = [
  {
    id: 'u1',
    // Нерозривний шматок навмисне довший за екран: саме на такій пошті картка
    // й розсуває сторінку вбік, якщо переносу немає.
    email: 'olenakovalenkovchytelkapochatkovyhklasiv@example.org',
    display_name: null,
    is_anonymous: false,
    group_name: 'Друга група підготовки',
    role: 'teacher',
    created_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'u2',
    email: null,
    display_name: 'Андрій',
    is_anonymous: true,
    group_name: '6-ф',
    role: 'student',
    created_at: '2026-09-15T09:00:00Z',
  },
]

async function openAdmin(page, width) {
  await page.setViewportSize({ width, height: 800 })
  await signInAsTeacher(page, {
    profile: { display_name: 'Модератор', group_id: null, role: 'moderator' },
    allUsers: USERS,
  })
  await page.goto('/admin')
  await page.waitForSelector('.admin__table tbody tr')
}

test('таблиця адмінки вміщується в телефон', async ({ page }) => {
  await openAdmin(page, 360)

  const measured = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    wrap: document.querySelector('.admin__table-wrap').scrollWidth,
    wrapVisible: document.querySelector('.admin__table-wrap').clientWidth,
  }))

  expect(measured.scrollWidth).toBe(360)
  // Таблиця не має ховати колонки за бічним догортуванням.
  expect(measured.wrap).toBe(measured.wrapVisible)
})

/**
 * Без підпису «Роль» сам по собі бейдж «Учень» ще читається, а ось дата
 * «15 вер. 2026» без підпису не каже, чи це реєстрація, чи остання гра.
 */
test('на телефоні кожна клітинка має свій підпис', async ({ page }) => {
  await openAdmin(page, 360)

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('.admin__table tbody tr:first-child td')].map((cell) =>
      getComputedStyle(cell, '::before').content.replaceAll('"', ''),
    ),
  )

  expect(labels).toEqual(['Користувач', 'Тип входу', 'Група', 'Роль', 'Зареєстрований'])
})

test('на комп’ютері лишається звичайна таблиця', async ({ page }) => {
  await openAdmin(page, 1280)

  const display = await page.evaluate(
    () => getComputedStyle(document.querySelector('.admin__table tbody tr')).display,
  )

  expect(display).toBe('table-row')
})
