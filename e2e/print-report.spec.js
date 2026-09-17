import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeStudents, makeResults } from './support/teacher'

const CHILD = { id: 'child-1', display_name: 'Андрій', group_id: 'g1' }
const PARENT = { display_name: 'Мама', group_id: null, role: 'parent' }

const RESULTS = [
  { game_id: 'schulte', score: 80, metrics: { total: 5 }, level_id: 'classic', played_at: '2026-09-14T10:00:00Z', entries: [] },
  { game_id: 'schulte', score: 95, metrics: { total: 5 }, level_id: 'classic', played_at: '2026-09-13T10:00:00Z', entries: [] },
]

async function openParentReport(page) {
  await signInAsTeacher(page, {
    profile: PARENT,
    parentLinks: [{ student_id: CHILD.id, created_at: '2026-09-10T10:00:00Z' }],
    students: [CHILD],
    results: RESULTS,
  })
  await page.goto('/child')
  await expect(page.getByRole('heading', { name: 'Андрій' })).toBeVisible()
}

test('на екрані шапки звіту немає', async ({ page }) => {
  await openParentReport(page)

  await expect(page.getByText(/Звіт про заняття: Андрій/)).toBeHidden()
})

test('на папері з’являється шапка з іменем і датою', async ({ page }) => {
  await openParentReport(page)
  await page.emulateMedia({ media: 'print' })

  await expect(page.getByText(/Звіт про заняття: Андрій/)).toBeVisible()
  await expect(page.locator('.child-progress__print-head')).toContainText('Inclusive Games')
})

/**
 * Головне, чого не має бути на аркуші: навігація, кнопки і поле для коду. Вони
 * або порожні прямокутники, або — у випадку коду — те, що не можна лишати на
 * столі.
 */
test('на папері немає ні навігації, ні поля для коду', async ({ page }) => {
  await openParentReport(page)
  await page.emulateMedia({ media: 'print' })

  await expect(page.locator('.site-header')).toBeHidden()
  await expect(page.locator('.site-footer')).toBeHidden()
  await expect(page.getByLabel('Код від учителя')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Друкувати' })).toBeHidden()
})

test('на папері лишається те, заради чого звіт друкують', async ({ page }) => {
  await openParentReport(page)
  await page.emulateMedia({ media: 'print' })

  await expect(page.getByText('Таблиці Шульте')).toBeVisible()
  await expect(page.getByText(/Найкращий бал: 95/)).toBeVisible()
})

/**
 * Темна тема на папері дає сірий текст на сірому тлі й з'їдає тонер. Колір
 * зводиться до чорного на білому явно, а не сподіванням на налаштування
 * друкарки.
 */
test('темна тема не потрапляє на папір', async ({ page }) => {
  await openParentReport(page)
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
  })
  await page.emulateMedia({ media: 'print' })

  /*
   * Дочекатися саме тих вузлів, у яких вимірюється колір. Без цього під
   * навантаженням повного прогону вони могли ще не з'явитися, і вимір падав на
   * getComputedStyle(null) — тест хитався не через колір, а через час.
   */
  await page.locator('.child-progress__game-meta').first().waitFor()
  await page.locator('.child-progress__game').first().waitFor()

  const colors = await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    const root = getComputedStyle(document.documentElement)
    // Приглушений текст бере колір із токена, а не з body — саме він показує,
    // чи справді перевизначено набір кольорів, а не тільки два оголошення.
    const muted = getComputedStyle(document.querySelector('.child-progress__game-meta'))
    const card = getComputedStyle(document.querySelector('.child-progress__game'))
    return {
      background: body.backgroundColor,
      text: body.color,
      muted: muted.color,
      card: card.backgroundColor,
      tokenText: root.getPropertyValue('--text').trim(),
    }
  })

  expect(colors.background).toBe('rgb(255, 255, 255)')
  expect(colors.text).toBe('rgb(0, 0, 0)')
  expect(colors.card).toBe('rgb(255, 255, 255)')
  expect(colors.muted).toBe('rgb(51, 51, 51)')
  expect(colors.tokenText).toBe('#000')
})

test('код приєднання не потрапляє на роздрукований звіт групи', async ({ page }) => {
  const students = makeStudents(2)
  await signInAsTeacher(page, {
    groups: [{ id: 'g1', name: '6-ф', join_code: '456F64', created_at: '2026-09-01T10:00:00Z' }],
    students,
    results: makeResults(students),
  })
  await page.goto('/groups/g1')
  await expect(page.getByRole('heading', { name: '6-ф' })).toBeVisible()

  await expect(page.getByText('456F64')).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByText('456F64')).toBeHidden()
  await expect(page.getByText(/Звіт про заняття/)).toBeVisible()
})
