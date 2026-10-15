import { test, expect } from '@playwright/test'

/*
 * Англійська — для батьків з діаспори. Ігри й довідка лишаються українською,
 * і на таких сторінках це сказано прямо, а сама сторінка позначена lang="uk",
 * щоб читач екрана читав її українським голосом.
 */
test('англійська вмикається в підвалі й переживає перезавантаження', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Мова' }).selectOption('en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Games that train attention, memory and thinking',
  )
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toContainText('Games')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Where to start' })).toBeVisible()
})

test('неперекладена сторінка каже про це і позначена українською', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('inclusive-games:locale', 'en'))
  await page.goto('/help')

  await expect(page.getByRole('note')).toContainText('available in Ukrainian only')
  await expect(page.locator('main')).toHaveAttribute('lang', 'uk')

  await page.goto('/')
  await expect(page.getByRole('note')).toHaveCount(0)
  await expect(page.locator('main')).not.toHaveAttribute('lang', 'uk')
})

test('на сторінці входу є шлях для батьків', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('inclusive-games:locale', 'en'))
  await page.goto('/login')
  await page.getByRole('button', { name: /I’m a parent/ }).click()
  await expect(page.getByRole('heading', { name: 'I’m a parent' })).toBeVisible()
  await expect(page.getByText(/open “My child” and enter the code/)).toBeVisible()
})
