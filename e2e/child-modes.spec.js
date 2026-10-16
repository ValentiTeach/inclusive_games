import { test, expect } from '@playwright/test'

/*
 * Режим без читання вмикає дорослий у налаштуваннях — для пристрою дитини.
 * Ігри стають великими картинками, опис ховається, а розділи для дорослих
 * на головній зникають.
 */
test('режим без читання: картинки ігор замість тексту', async ({ page }) => {
  await page.goto('/settings')
  const row = page.locator('.settings__row', { has: page.getByRole('heading', { name: 'Без читання' }) })
  await row.getByRole('button', { name: 'Увімкнено' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-picture-mode', 'on')

  await page.goto('/games')
  const card = page.locator('.game-card', { hasText: 'Таблиці Шульте' })
  await expect(card.locator('.game-card__picture')).toHaveText('🔢')
  await expect(card.locator('.game-card__description')).toBeHidden()
  await expect(page.getByRole('group', { name: /Сховати ігри/ })).toHaveCount(0)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'З чого почати' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Переглянути каталог ігор' })).toBeVisible()
})

test('сад: назва, улюблена рослина й пора року', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-12T10:00:00'))
  // Сад з'являється, щойно є хоч одна зіграна гра.
  await page.addInitScript(() => {
    localStorage.setItem(
      'inclusive-games:results:schulte',
      JSON.stringify([{ score: 70, entries: [], levelId: 'classic', date: '2026-01-11T10:00:00Z' }]),
    )
  })
  await page.goto('/progress')

  const garden = page.getByRole('img', { name: /Сад/ })
  await expect(garden).toHaveAttribute('aria-label', /Надворі зима/)

  await page.getByRole('button', { name: 'Назвати сад і обрати рослину' }).click()
  await page.getByLabel('Як звати твій сад?').fill('Чарівний сад')
  await page.getByRole('button', { name: 'Назвати' }).click()
  await page.getByRole('button', { name: 'соняшник' }).click()

  await expect(page.getByRole('heading', { name: 'Чарівний сад' })).toBeVisible()
  await expect(garden).toHaveAttribute('aria-label', /Посередині — соняшник, пагінець/)

  // Назва переживає перезавантаження.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Чарівний сад' })).toBeVisible()
})
