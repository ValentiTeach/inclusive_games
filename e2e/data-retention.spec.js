import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

/*
 * Дані дітей: позначка згоди батьків, нагадування про строк зберігання,
 * видалення модератором і бланк згоди для друку — у справжньому браузері.
 */

const GROUP = { id: 'g1', name: '2-Б', join_code: 'XYZ789', created_at: '2025-09-01T09:00:00Z' }

function monthsAgo(months) {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date.toISOString()
}

const STUDENTS = [
  { id: 's-old', display_name: 'Тарас', created_at: monthsAgo(20) },
  { id: 's-new', display_name: 'Соломія', created_at: monthsAgo(2) },
]

const RESULTS = [
  { user_id: 's-old', game_id: 'schulte', level_id: 'classic', score: 60, metrics: {}, played_at: monthsAgo(14) },
  { user_id: 's-new', game_id: 'schulte', level_id: 'classic', score: 80, metrics: {}, played_at: monthsAgo(0) },
]

test('учитель відмічає згоду батьків і бачить, хто не грав понад рік', async ({ page }) => {
  const posted = []
  await signInAsTeacher(page, {
    group: GROUP,
    groups: [GROUP],
    students: STUDENTS,
    results: RESULTS,
    consents: [{ student_id: 's-new', given_on: '2026-09-01' }],
    posted,
  })
  await page.goto('/groups/g1')

  await expect(page.getByRole('columnheader', { name: 'Згода батьків' })).toBeVisible()
  await expect(page.getByText('Один учень не грав')).toBeVisible()
  await expect(page.locator('.group-detail__stale')).toHaveCount(1)
  await expect(page.getByRole('row', { name: /Тарас/ }).getByText('понад рік')).toBeVisible()

  await expect(page.getByRole('button', { name: /Згода батьків Соломія: отримано/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Відмітити, що згоду батьків Тарас отримано' }).click()
  await expect(page.getByRole('button', { name: /Згода батьків Тарас: отримано/ })).toBeVisible()
  expect(posted.find((entry) => entry.table === 'parental_consents').payload.student_id).toBe('s-old')
})

test('модератор бачить учнів за строком і видаляє їх', async ({ page }) => {
  const rpcCalls = []
  await signInAsTeacher(page, {
    profile: { display_name: 'Модератор', group_id: null, role: 'moderator' },
    allUsers: [],
    inactive: [
      { student_id: 's-old', display_name: 'Тарас', group_id: 'g1', last_activity: monthsAgo(14) },
      { student_id: 's-gone', display_name: 'Ярема', group_id: null, last_activity: monthsAgo(30) },
    ],
    rpcCalls,
  })
  await page.goto('/admin')

  await page.getByRole('button', { name: /Знайти учнів без активності/ }).click()
  await expect(page.getByRole('cell', { name: 'прибраний з групи' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Видалити Ярема назавжди' }).click()
  await expect(page.getByRole('status')).toHaveText('«Ярема» видалено.')
  expect(rpcCalls).toContainEqual({ path: 'rpc/moderator_delete_student', args: { p_student_id: 's-gone' } })
})

test('бланк згоди відкривається з /privacy і друкується без навігації', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByText('12 місяців', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /бланк згоди для друку/ }).click()

  await expect(page).toHaveURL(/\/privacy\/consent$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Згода на обробку даних дитини/)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Друкувати бланк' })).toBeHidden()
  await expect(page.locator('.site-header')).toBeHidden()
  await expect(page.getByRole('heading', { name: '5. Ваші права' })).toBeVisible()
})
