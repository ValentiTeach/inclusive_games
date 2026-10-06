import { test, expect } from '@playwright/test'

/*
 * Порожній екран після деплою.
 *
 * Хостинг віддає index.html на будь-яку невідому адресу, тож головний скрипт,
 * якого вже немає (або зіпсований кеш на пристрої), приходить як HTML.
 * Браузер його не виконує, React нічого не малює, і в темній темі це просто
 * чорний екран. Запобіжник в index.html має пояснити, що сталося, і дати
 * кнопку, яка чистить кеш і повертає сайт.
 */
test('замість порожнього екрана — пояснення і кнопка, що повертає сайт', async ({ page }) => {
  test.setTimeout(60_000)
  let broken = true
  await page.route('**/assets/index-*.js', async (route) => {
    if (!broken) return route.fallback()
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' })
  })

  await page.goto('/')
  const alert = page.getByRole('alert').filter({ hasText: 'Сайт не завантажився' })
  await expect(alert).toBeVisible({ timeout: 15_000 })

  broken = false
  await alert.getByRole('button', { name: 'Оновити сайт' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#boot-fallback')).toHaveCount(0)
})

test('коли сайт стартував, запобіжник мовчить', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForTimeout(10_500)
  await expect(page.locator('#boot-fallback')).toHaveCount(0)
})
