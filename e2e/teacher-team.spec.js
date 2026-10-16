import { test, expect } from '@playwright/test'
import { signInAsTeacher, TEACHER_ID } from './support/teacher.js'

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString()

const GROUP = { id: 'g1', name: '3-Б', join_code: 'ABC234', created_at: daysAgo(90), teacher_id: TEACHER_ID }
const OTHER = { id: 'g2', name: '4-Б', join_code: 'XYZ789', created_at: daysAgo(10), teacher_id: TEACHER_ID }

const STUDENTS = [
  { id: 's1', display_name: 'Оля', created_at: daysAgo(80), avatar: 'fox' },
  { id: 's2', display_name: 'Петро', created_at: daysAgo(80), avatar: null },
]

// Оля грає щотижня, а цього тижня бал у Шульте помітно просів; Петро не
// грав місяць.
const RESULTS = [
  { user_id: 's1', game_id: 'schulte', level_id: 'classic', score: 84, metrics: {}, played_at: daysAgo(10) },
  { user_id: 's1', game_id: 'schulte', level_id: 'classic', score: 80, metrics: {}, played_at: daysAgo(14) },
  { user_id: 's1', game_id: 'schulte', level_id: 'classic', score: 55, metrics: {}, played_at: daysAgo(1) },
  { user_id: 's1', game_id: 'schulte', level_id: 'classic', score: 59, metrics: {}, played_at: daysAgo(2) },
  { user_id: 's2', game_id: 'stroop', level_id: 'classic', score: 70, metrics: {}, played_at: daysAgo(30) },
]

const TEAM = [
  { user_id: TEACHER_ID, display_name: 'Вчителька', email: 'teacher@test.local', is_owner: true, added_at: daysAgo(90) },
]

test('підсумок тижня називає, хто не грав і у кого просів бал', async ({ page }) => {
  await signInAsTeacher(page, { groups: [GROUP], students: [...STUDENTS], results: RESULTS })
  await page.goto('/groups/g1')

  const digest = page.getByRole('region', { name: 'Підсумок тижня' })
  await expect(digest).toContainText('грали 1 з 2')
  await expect(digest.getByRole('heading', { name: /Не грали/ }).locator('..')).toContainText('Петро')
  await expect(digest.getByRole('heading', { name: 'Бал просів' }).locator('..')).toContainText(
    'Таблиці Шульте: 82 → 57',
  )
  // Тваринка дитини поруч з іменем.
  await expect(digest.getByRole('img', { name: 'Лисичка' }).first()).toBeVisible()
})

test('власник додає колегу за поштою й бачить його в команді', async ({ page }) => {
  const rpcCalls = []
  await signInAsTeacher(page, { groups: [GROUP], students: [...STUDENTS], team: [...TEAM], rpcCalls })
  await page.goto('/groups/g1')

  const panel = page.getByRole('region', { name: 'Хто веде групу' })
  await panel.getByLabel(/Додати колегу/).fill(' logoped@school.ua ')
  await panel.getByRole('button', { name: 'Додати' }).click()

  await expect(panel.getByRole('status')).toContainText('logoped@school.ua тепер бачить цю групу')
  await expect(panel).toContainText('фахівець')
  expect(rpcCalls).toContainEqual({
    path: 'rpc/add_group_specialist',
    args: { p_group_id: 'g1', p_email: 'logoped@school.ua' },
  })
})

test('без міграції розділу «Хто веде групу» немає', async ({ page }) => {
  await signInAsTeacher(page, { groups: [GROUP], students: [...STUDENTS], team: null })
  await page.goto('/groups/g1')
  await expect(page.getByRole('heading', { name: '3-Б' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Підсумок тижня' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Хто веде групу' })).toHaveCount(0)
})

test('дитину переводять у свою іншу групу одним натиском', async ({ page }) => {
  const rpcCalls = []
  await signInAsTeacher(page, {
    groups: [GROUP, OTHER],
    group: GROUP,
    students: [...STUDENTS],
    rpcCalls,
  })
  await page.goto('/groups/g1')

  await page.getByRole('button', { name: 'Перевести Петро в іншу групу' }).click()
  const dialog = page.getByRole('dialog', { name: /Перевести Петро/ })
  page.once('dialog', (confirm) => confirm.accept())
  await dialog.getByRole('button', { name: '4-Б' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Петро тепер у групі «4-Б»' })).toBeVisible()
  expect(rpcCalls).toContainEqual({
    path: 'rpc/teacher_move_student',
    args: { p_student_id: 's2', p_target_code: 'XYZ789' },
  })
  await expect(page.getByRole('link', { name: 'Петро' })).toHaveCount(0)
})

test('бланк спостереження і картки ігор відкриваються й друкуються', async ({ page }) => {
  await page.goto('/print/observation')
  await expect(page.getByRole('heading', { name: 'Бланк спостереження' })).toBeVisible()
  await expect(page.locator('.print-sheet__table tbody tr')).toHaveCount(6)

  await page.goto('/print/cards?category=memory')
  await expect(page.getByRole('heading', { name: 'Картки ігор' })).toBeVisible()
  await expect(page.locator('.print-card').first()).toContainText('Пам')
  await expect(page.locator('.print-card', { hasText: 'Таблиці Шульте' })).toHaveCount(0)

  // На папері — лише картки, без пояснень і кнопки.
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: /Друкувати картки/ })).toBeHidden()
  await expect(page.locator('.print-card').first()).toBeVisible()
})

test('лист раз на тиждень вмикає сам учитель', async ({ page }) => {
  const posted = []
  await signInAsTeacher(page, { posted })
  await page.goto('/account')

  const section = page.getByRole('region', { name: 'Листи' })
  await section.getByRole('checkbox', { name: /підсумок тижня/ }).check()
  await expect(section.getByRole('status')).toHaveText('Збережено.')
  expect(posted.find((entry) => entry.table === 'notification_settings').payload).toMatchObject({
    user_id: TEACHER_ID,
    weekly_digest: true,
    parent_requests: false,
  })
  // Не модератору — без перемикача заявок.
  await expect(section.getByRole('checkbox')).toHaveCount(1)
})
