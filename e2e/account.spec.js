import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

const TEACHER = { display_name: 'Вчителька', group_id: null, role: 'teacher' }
const GROUP = { id: 'g1', name: '3-Б', join_code: 'ABC234', created_at: '2026-09-01T00:00:00Z' }

/*
 * Вихід і зміна пошти йдуть не в PostgREST, а в GoTrue (/auth/v1). Маршрутизатор
 * вчителя їх не бачить, тож вони підміняються тут і збираються в `calls`.
 */
async function routeAuth(page, calls) {
  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push({ method: request.method(), path: url.pathname, scope: url.searchParams.get('scope') })

    if (url.pathname.endsWith('/user') && request.method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'teacher', email: 'teacher@test.local', new_email: 'new@school.ua' }),
      })
      return
    }
    await route.fulfill({ status: 204, body: '' })
  })
}

test('вчитель із групою не видалить акаунт, доки не вирішить, що з групою', async ({ page }) => {
  const rpcCalls = []
  const authCalls = []
  await signInAsTeacher(page, { profile: TEACHER, groups: [GROUP], rpcCalls })
  await routeAuth(page, authCalls)
  await page.goto('/account')

  const section = page.getByRole('region', { name: 'Видалити акаунт' })
  await expect(section).toContainText('3-Б')

  const remove = section.getByRole('button', { name: 'Видалити акаунт назавжди' })
  await section.getByLabel(/Щоб підтвердити/).fill('видалити')
  await expect(remove).toBeDisabled()

  await section.getByRole('checkbox').check()
  await expect(remove).toBeEnabled()
  await remove.click()

  await expect(page.getByRole('heading', { name: 'Акаунт видалено' })).toBeVisible()
  expect(rpcCalls).toEqual([{ path: 'rpc/delete_my_account', args: { p_delete_groups: true } }])

  // Сеанс видаленого акаунта прибрано, а сторінка все одно каже, що сталося.
  await expect.poll(() => authCalls.find((call) => call.path.endsWith('/logout'))?.scope).toBe('local')
  await expect(page.getByRole('heading', { name: 'Акаунт видалено' })).toBeVisible()
})

test('групи можна передати колезі, і тоді акаунт видаляється без них', async ({ page }) => {
  const rpcCalls = []
  await signInAsTeacher(page, { profile: TEACHER, groups: [GROUP], rpcCalls })
  await routeAuth(page, [])
  await page.goto('/account')

  page.once('dialog', (dialog) => dialog.accept())
  const section = page.getByRole('region', { name: 'Видалити акаунт' })
  await section.getByLabel(/пошта вчителя/).fill(' kolega@school.ua ')
  await section.getByRole('button', { name: 'Передати групи' }).click()

  await expect(section.getByRole('status')).toContainText('Передано груп: 1')
  await expect(section.getByRole('checkbox')).toHaveCount(0)
  expect(rpcCalls[0]).toEqual({ path: 'rpc/transfer_my_groups', args: { p_email: 'kolega@school.ua' } })

  await section.getByLabel(/Щоб підтвердити/).fill('ВИДАЛИТИ')
  await section.getByRole('button', { name: 'Видалити акаунт назавжди' }).click()
  await expect(page.getByRole('heading', { name: 'Акаунт видалено' })).toBeVisible()
  expect(rpcCalls[1].args).toEqual({ p_delete_groups: false })
})

test('незнайомого колегу пояснює словами', async ({ page }) => {
  await signInAsTeacher(page, {
    profile: TEACHER,
    groups: [GROUP],
    accountError: 'teacher_not_found',
  })
  await page.goto('/account')

  page.once('dialog', (dialog) => dialog.accept())
  const section = page.getByRole('region', { name: 'Видалити акаунт' })
  await section.getByLabel(/пошта вчителя/).fill('nobody@school.ua')
  await section.getByRole('button', { name: 'Передати групи' }).click()

  await expect(section).toContainText('Вчителя з такою поштою не знайдено')
})

test('модератор бачить пояснення замість кнопки', async ({ page }) => {
  await signInAsTeacher(page, { profile: { ...TEACHER, role: 'moderator' } })
  await page.goto('/account')

  const section = page.getByRole('region', { name: 'Видалити акаунт' })
  await expect(section).toContainText('Модератор не може видалити себе сам')
  await expect(section.getByRole('button')).toHaveCount(0)
})

test('вихід на всіх пристроях відкликає всі сеанси, а не лише цей', async ({ page }) => {
  const authCalls = []
  await signInAsTeacher(page, { profile: TEACHER })
  await routeAuth(page, authCalls)
  await page.goto('/account')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Вийти на всіх пристроях' }).click()

  await expect.poll(() => authCalls.find((call) => call.path.endsWith('/logout'))?.scope).toBe('global')
})

test('зміна пошти чекає підтвердження з листа', async ({ page }) => {
  const authCalls = []
  await signInAsTeacher(page, { profile: TEACHER })
  await routeAuth(page, authCalls)
  await page.goto('/account')

  await page.getByLabel('Нова пошта').fill('new@school.ua')
  await page.getByRole('button', { name: 'Змінити пошту' }).click()

  await expect(page.getByRole('status')).toContainText('Лист підтвердження надіслано на new@school.ua')
  expect(authCalls.some((call) => call.method === 'PUT' && call.path.endsWith('/user'))).toBe(true)
})

test('учень за кодом групи налаштувань дорослого не бачить', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-e2e-auth-token',
      JSON.stringify({
        access_token: 'e2e.fake.token',
        refresh_token: 'r',
        expires_at: 4102444800,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'kid', aud: 'authenticated', role: 'authenticated', is_anonymous: true },
      }),
    )
  })
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ display_name: 'Оля', group_id: 'g1', role: 'student' }]),
    }),
  )
  await page.goto('/account')

  await expect(page.getByRole('heading', { name: /Акаунт/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Видалити акаунт' })).toHaveCount(0)
  await expect(page.getByLabel('Нова пошта')).toHaveCount(0)
})
