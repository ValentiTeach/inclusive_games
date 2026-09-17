import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeStudents, makeResults } from './support/teacher'

const GROUP = { id: 'g1', name: '6-ф', join_code: '456F64', created_at: '2026-09-01T10:00:00Z' }

const DAY = 86400000

function invite(overrides) {
  return {
    code: 'AAAA1111',
    created_at: new Date(Date.now() - DAY).toISOString(),
    expires_at: new Date(Date.now() + 6 * DAY).toISOString(),
    used_at: null,
    revoked_at: null,
    parent_id: null,
    parent_label: null,
    ...overrides,
  }
}

/* Самі позначки стану: слово «діє» трапляється і в поясненні над списком. */
function states(page) {
  return page.locator('.parent-access__state')
}

async function openAccess(page, parentAccess) {
  const students = makeStudents(1)
  await signInAsTeacher(page, {
    groups: [GROUP],
    students,
    results: makeResults(students),
    parentAccess,
  })
  await page.goto('/groups/g1')
  await page.getByRole('button', { name: /Доступ батьків/ }).click()
  await expect(page.getByRole('heading', { name: /Доступ батьків/ })).toBeVisible()
}

test('учитель бачить виписані коди і їхній стан', async ({ page }) => {
  await openAccess(page, [
    invite({ code: 'AAAA1111' }),
    invite({ code: 'BBBB2222', revoked_at: new Date().toISOString() }),
    invite({ code: 'CCCC3333', expires_at: new Date(Date.now() - DAY).toISOString() }),
    invite({
      code: 'DDDD4444',
      used_at: new Date().toISOString(),
      parent_id: 'p1',
      parent_label: 'Мама Андрія',
    }),
  ])

  await expect(page.getByText('AAAA1111')).toBeVisible()
  await expect(states(page)).toHaveText(['Діє', 'Скасовано', 'Строк минув', 'Використано'])
  await expect(page.getByText('Мама Андрія')).toBeVisible()
})

/**
 * Головне, чого бракувало: загублений на столі код має бути чим погасити.
 */
test('чинний код можна скасувати', async ({ page }) => {
  await openAccess(page, [invite({ code: 'AAAA1111' })])

  await expect(states(page)).toHaveText(['Діє'])
  await page.getByRole('button', { name: 'Скасувати код AAAA1111' }).click()

  await expect(states(page)).toHaveText(['Скасовано'])
})

/**
 * Скасувати використаний код нічим не допоможе: доступ живе у зв'язку, а не в
 * коді. Тому на такому рядку кнопки скасування немає взагалі — є інша.
 */
test('на використаному коді пропонується відібрати доступ, а не скасувати код', async ({
  page,
}) => {
  await openAccess(page, [
    invite({
      code: 'DDDD4444',
      used_at: new Date().toISOString(),
      parent_id: 'p1',
      parent_label: 'Мама Андрія',
    }),
  ])

  await expect(page.getByRole('button', { name: /Скасувати код/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Відібрати доступ/ })).toBeVisible()
})

test('доступ дорослого можна відібрати', async ({ page }) => {
  await openAccess(page, [
    invite({
      code: 'DDDD4444',
      used_at: new Date().toISOString(),
      parent_id: 'p1',
      parent_label: 'Мама Андрія',
    }),
  ])

  await page.getByRole('button', { name: 'Відібрати доступ у Мама Андрія' }).click()

  await expect(page.getByRole('button', { name: /Відібрати доступ/ })).toHaveCount(0)
  await expect(page.getByText('Мама Андрія')).toHaveCount(0)
})

test('новий код одразу з’являється в списку', async ({ page }) => {
  await openAccess(page, [])

  await expect(page.getByText('Жодного коду ще не виписано')).toBeVisible()
  await page.getByRole('button', { name: 'Виписати новий код' }).click()

  await expect(page.getByText('NEW1CODE')).toBeVisible()
  await expect(states(page)).toHaveText(['Діє'])
})

/**
 * На скасованому й протермінованому коді кнопок немає: вони нічого не
 * відкривають, і скасовувати там уже нічого.
 */
test('мертві коди не пропонують дій', async ({ page }) => {
  await openAccess(page, [
    invite({ code: 'BBBB2222', revoked_at: new Date().toISOString() }),
    invite({ code: 'CCCC3333', expires_at: new Date(Date.now() - DAY).toISOString() }),
  ])

  await expect(page.getByRole('button', { name: /Скасувати код/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Скопіювати код/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Відібрати доступ/ })).toHaveCount(0)
})

test('панель із кодами не потрапляє на роздрукований звіт', async ({ page }) => {
  await openAccess(page, [invite({ code: 'AAAA1111' })])

  await expect(page.getByText('AAAA1111')).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByText('AAAA1111')).toBeHidden()
})
