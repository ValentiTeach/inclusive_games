import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const CHILD = { id: 'child-1', display_name: 'Андрій', group_id: 'g1' }

/*
 * Чотири спроби — рівно стільки, скільки improvement вимагає, щоб узагалі щось
 * сказати. Найкращий бал (95) навмисно НЕ в найновішій спробі: інакше
 * «найкращий» і «останній» були б одним числом, і тест не відрізнив би
 * максимум від першого-ліпшого рядка.
 *
 * Від найновішої до найстарішої: 80, 95, 50, 40. Зростання: (50+80)/2 −
 * (40+50)/2 … рахується за половинами впорядкованого списку, тож +43.
 */
const RESULTS = [
  { game_id: 'schulte', score: 80, metrics: { total: 5, best_rt_ms: 700 }, level_id: 'classic', played_at: '2026-09-14T10:00:00Z', entries: [] },
  { game_id: 'schulte', score: 95, metrics: { total: 5, best_rt_ms: 900 }, level_id: 'classic', played_at: '2026-09-13T10:00:00Z', entries: [] },
  { game_id: 'schulte', score: 50, metrics: { total: 5, best_rt_ms: 1200 }, level_id: 'classic', played_at: '2026-09-12T10:00:00Z', entries: [] },
  { game_id: 'schulte', score: 40, metrics: { total: 5, best_rt_ms: 1500 }, level_id: 'classic', played_at: '2026-09-11T10:00:00Z', entries: [] },
]

const PARENT = { display_name: 'Мама', group_id: null, role: 'parent' }

test('дорослий без дитини бачить, що робити далі', async ({ page }) => {
  await signInAsTeacher(page, { profile: PARENT, parentLinks: [] })
  await page.goto('/child')

  await expect(page.getByText(/попросіть у вчителя код/)).toBeVisible()
  await expect(page.getByLabel('Код від учителя')).toBeVisible()
})

test('неправильний код пояснюється словами, а не кодом помилки', async ({ page }) => {
  await signInAsTeacher(page, { profile: PARENT, parentLinks: [], redeemed: 'invalid_code' })
  await page.goto('/child')

  await page.getByLabel('Код від учителя').fill('ZZZZZZZZ')
  await page.getByRole('button', { name: 'Додати дитину' }).click()

  await expect(page.getByText(/Такого коду немає/)).toBeVisible()
})

/**
 * Використаний код і неправильний код — різні біди з різними діями: перший
 * означає «попроси новий», другий — «перевір літери». Один спільний текст
 * відправляв би половину батьків не туди.
 */
test('використаний код відрізняється від неправильного', async ({ page }) => {
  await signInAsTeacher(page, {
    profile: PARENT,
    parentLinks: [],
    redeemed: 'code_already_used',
  })
  await page.goto('/child')

  await page.getByLabel('Код від учителя').fill('KRDM47XZ')
  await page.getByRole('button', { name: 'Додати дитину' }).click()

  await expect(page.getByText(/уже використали/)).toBeVisible()
  await expect(page.getByText(/Такого коду немає/)).toHaveCount(0)
})

test('дорослий бачить прогрес своєї дитини', async ({ page }) => {
  await signInAsTeacher(page, {
    profile: PARENT,
    parentLinks: [{ student_id: CHILD.id, created_at: '2026-09-10T10:00:00Z' }],
    students: [CHILD],
    results: RESULTS,
  })
  await page.goto('/child')

  await expect(page.getByRole('heading', { name: 'Андрій' })).toBeVisible()
  await expect(page.getByText('Таблиці Шульте')).toBeVisible()
  await expect(page.getByText(/Усього спроб/)).toContainText('4')
  await expect(page.getByText(/Найкращий бал: 95/)).toBeVisible()
  await expect(page.getByText(/Бал виріс на 43/)).toBeVisible()
})

/**
 * Головна обіцянка цієї сторінки: дорослий бачить свою дитину і більше нікого.
 * На сервері це тримає RLS, тут — те, що сторінка взагалі не питає нічого
 * ширшого за власні зв'язки.
 */
test('сторінка не питає нічого, ширшого за власні зв’язки', async ({ page }) => {
  const asked = []
  await signInAsTeacher(page, {
    profile: PARENT,
    parentLinks: [{ student_id: CHILD.id, created_at: '2026-09-10T10:00:00Z' }],
    students: [CHILD],
    results: RESULTS,
  })
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/')) asked.push(request.url())
  })
  await page.goto('/child')
  await expect(page.getByRole('heading', { name: 'Андрій' })).toBeVisible()

  const links = asked.filter((url) => url.includes('parent_links'))
  expect(links.length).toBeGreaterThan(0)
  for (const url of links) {
    expect(url).toContain('parent_id=eq.')
  }

  for (const url of asked.filter((u) => u.includes('/results'))) {
    expect(url).toContain('user_id=eq.child-1')
  }
})
