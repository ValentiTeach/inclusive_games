import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

/*
 * CSP перевіряється в справжньому браузері.
 *
 * vite preview віддає ті самі заголовки, що й vercel.json (див. vite.config.js),
 * тож увесь набір E2E і так іде під CSP. Але зламаний CSP не завжди ламає тест:
 * заблокований стиль чи шрифт лише псує вигляд. Тому тут окремо збираються всі
 * порушення — подія securitypolicyviolation — і їх має бути нуль.
 */

async function watchViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ← ${event.blockedURI}`)
    })
  })
}

const violations = (page) => page.evaluate(() => window.__cspViolations)

const GUEST_PAGES = [
  '/',
  '/games',
  '/games/schulte',
  '/games/memory-pairs',
  '/progress',
  '/settings',
  '/privacy',
  '/privacy/consent',
  '/help',
  '/accessibility',
  '/feedback',
  '/login',
  '/join',
]

test('сторінки віддаються з CSP і без жодного порушення', async ({ page }) => {
  await watchViolations(page)

  for (const path of GUEST_PAGES) {
    const response = await page.goto(path)
    expect(response.headers()['content-security-policy'], path).toContain("frame-ancestors 'none'")
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible()
    expect(await violations(page), path).toEqual([])
  }
})

/*
 * Тема ставиться вбудованим скриптом до першого кадру, і CSP пропускає його
 * лише за хешем. Якщо хеш розійшовся з текстом скрипта, браузер мовчки його
 * пропускає — і темна тема спалахує білим. Тут видно саме це.
 */
test('вбудований скрипт теми виконується під CSP', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('inclusive-games:settings', JSON.stringify({ theme: 'dark' }))
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('сторінки вчителя й модератора теж без порушень', async ({ page }) => {
  await watchViolations(page)
  await signInAsTeacher(page, {
    profile: { display_name: 'Модератор', group_id: null, role: 'moderator' },
    groups: [{ id: 'g1', name: '3-Б', join_code: 'ABC234', created_at: '2026-09-01T00:00:00Z' }],
  })

  for (const path of ['/groups', '/groups/g1', '/admin', '/account']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible()
    expect(await violations(page), path).toEqual([])
  }
})

test('інші заголовки безпеки на місці', async ({ page }) => {
  const response = await page.goto('/')
  const headers = response.headers()

  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(headers['permissions-policy']).toContain('camera=()')
  expect(headers['x-frame-options']).toBe('DENY')
})
