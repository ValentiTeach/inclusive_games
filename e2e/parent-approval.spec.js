import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const MODERATOR = { display_name: 'Модератор', group_id: null, role: 'moderator' }

function request(overrides) {
  return {
    request_id: 'r1',
    created_at: '2026-10-05T09:00:00Z',
    parent_id: 'p1',
    parent_email: 'mama.andriia@example.org',
    parent_name: 'Мама',
    parent_role: 'teacher',
    parent_has_groups: false,
    student_id: 's1',
    student_name: 'Андрій',
    group_name: '6-ф',
    teacher_name: 'Олена Петрівна',
    invited_by_name: 'Олена Петрівна',
    ...overrides,
  }
}

async function openAdmin(page, fixtures) {
  await signInAsTeacher(page, { profile: MODERATOR, allUsers: [], ...fixtures })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Заявки батьків' })).toBeVisible()
}

test('модератор бачить усе, за чим вирішує', async ({ page }) => {
  await openAdmin(page, { requestQueue: [request()] })

  const card = page.locator('.parent-requests__item')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('mama.andriia@example.org')
  await expect(card).toContainText('Андрій')
  await expect(card).toContainText('6-ф')
  await expect(card).toContainText('Олена Петрівна')
})

test('шапка показує, скільки заявок чекає', async ({ page }) => {
  await openAdmin(page, {
    requestQueue: [request(), request({ request_id: 'r2', parent_id: 'p2' })],
  })

  const link = page.getByRole('link', { name: /Адмінка/ })
  await expect(link).toContainText('заявок батьків: 2')
  await expect(link.locator('.site-header__badge')).toHaveText('2')
})

/**
 * Рішення про чужі дані не приймається однією помилкою пальця: на кнопці
 * стоїть підтвердження, і без нього на сервер нічого не йде.
 */
test('схвалення йде на сервер лише після підтвердження', async ({ page }) => {
  const decisions = []
  await openAdmin(page, { requestQueue: [request()], decisions })

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: /Підтвердити: mama\.andriia/ }).click()
  expect(decisions).toEqual([])
  await expect(page.locator('.parent-requests__item')).toHaveCount(1)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Підтвердити: mama\.andriia/ }).click()

  await expect(page.getByRole('status')).toContainText('тепер бачить результати «Андрій»')
  expect(decisions).toEqual([{ p_request_id: 'r1', p_approve: true }])
  await expect(page.locator('.parent-requests__item')).toHaveCount(0)
  await expect(page.getByText('Нових заявок немає.')).toBeVisible()
})

test('відхилення йде з прапорцем false, а лічильник зникає', async ({ page }) => {
  const decisions = []
  await openAdmin(page, { requestQueue: [request()], decisions })
  const badge = page.getByRole('link', { name: /Адмінка/ }).locator('.site-header__badge')
  await expect(badge).toHaveText('1')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Відхилити заявку mama\.andriia/ }).click()

  await expect(page.getByRole('status')).toContainText('відхилено')
  expect(decisions).toEqual([{ p_request_id: 'r1', p_approve: false }])
  await expect(badge).toHaveCount(0)
})

test('вчитель із групами бачить застереження про роль', async ({ page }) => {
  await openAdmin(page, { requestQueue: [request({ parent_has_groups: true })] })

  await expect(page.locator('.parent-requests__note')).toContainText('роль «Вчитель» збережеться')
})

test('без заявок панель каже про це й лічильника немає', async ({ page }) => {
  await openAdmin(page, { requestQueue: [] })

  await expect(page.getByText('Нових заявок немає.')).toBeVisible()
  await expect(page.locator('.site-header__badge')).toHaveCount(0)
})

test('картка заявки вміщується в телефон', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await openAdmin(page, {
    requestQueue: [
      request({ parent_email: 'olenakovalenkovchytelkapochatkovyhklasiv@example.org' }),
    ],
  })

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBe(360)
})

/** Не модератор ні заявок, ні лічильника не бачить — і запиту до бази не шле. */
test('вчитель не бачить ні панелі, ні лічильника', async ({ page }) => {
  const asked = []
  await signInAsTeacher(page, { requestQueue: [request()] })
  page.on('request', (req) => {
    if (req.url().includes('parent_requests') || req.url().includes('admin_list_parent_requests')) {
      asked.push(req.url())
    }
  })
  await page.goto('/admin')

  await expect(page.getByText('Доступ лише для модераторів.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Заявки батьків' })).toHaveCount(0)
  expect(asked).toEqual([])
})
