import { test, expect } from '@playwright/test'

const GAME = '/games/odd-one-out'

function historyOf(page, gameId = 'odd-one-out') {
  return page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`inclusive-games:results:${id}`) ?? '[]'),
    gameId,
  )
}

async function play(page) {
  await page.goto(GAME)
  await page.getByRole('button', { name: 'Почати' }).click()
  await page.waitForSelector('.odd__item')
}

test('на екрані вступу виходити нема звідки', async ({ page }) => {
  await page.goto(GAME)

  await expect(page.getByRole('button', { name: 'Вийти' })).toHaveCount(0)
})

test('посеред гри кнопка виходу є', async ({ page }) => {
  await play(page)

  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible()
})

/**
 * Випадковий дотик по «Вийти» не має коштувати дитині всієї спроби — тому між
 * дотиком і виходом стоїть питання.
 */
test('один дотик по «Вийти» ще не виводить', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Вийти' }).click()

  await expect(page.getByText(/Ця спроба не збережеться/)).toBeVisible()
  // Гра досі йде.
  await expect(page.locator('.odd__item')).toHaveCount(4)
})

test('«продовжити гру» повертає до гри', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Вийти' }).click()
  await page.getByRole('button', { name: 'Продовжити гру' }).click()

  await expect(page.getByText(/Ця спроба не збережеться/)).toHaveCount(0)
  await expect(page.locator('.odd__item')).toHaveCount(4)
})

test('підтверджений вихід повертає до вступу і нічого не зберігає', async ({ page }) => {
  await play(page)
  await page.locator('.odd__item').first().click()
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: 'Вийти' }).click()
  await page.getByRole('button', { name: 'Вийти', exact: true }).last().click()

  await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
  await expect(page.locator('.odd__item')).toHaveCount(0)
  expect(await historyOf(page)).toEqual([])
})

/**
 * Під час відліку втрачати ще нічого, тож питання зайве: воно б лише
 * затримувало дитину, яка зрозуміла, що відкрила не ту гру.
 */
test('під час відліку вихід не питає', async ({ page }) => {
  await page.goto(GAME)
  await page.getByRole('button', { name: 'Почати' }).click()

  await page.getByRole('button', { name: 'Вийти' }).click()

  await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
  await expect(page.getByText(/Ця спроба не збережеться/)).toHaveCount(0)
})

test('Escape відкриває питання, а другий Escape його знімає', async ({ page }) => {
  await play(page)

  await page.keyboard.press('Escape')
  await expect(page.getByText(/Ця спроба не збережеться/)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByText(/Ця спроба не збережеться/)).toHaveCount(0)
  await expect(page.locator('.odd__item')).toHaveCount(4)
})

/**
 * Гра могла дограти, поки дитина думала над питанням. Лишити його поверх
 * результату означало б питати про те, чого вже немає.
 */
test('питання зникає, якщо гра дограла сама', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Вийти' }).click()
  await expect(page.getByText(/Ця спроба не збережеться/)).toBeVisible()

  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }

  await expect(page.getByText('Результат')).toBeVisible()
  await expect(page.getByText(/Ця спроба не збережеться/)).toHaveCount(0)
})

test('після виходу гру можна почати заново', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Вийти' }).click()
  await page.getByRole('button', { name: 'Вийти', exact: true }).last().click()

  await page.getByRole('button', { name: 'Почати' }).click()
  await expect(page.locator('.odd__item')).toHaveCount(4)
})

test('на екрані результатів виходити нема звідки', async ({ page }) => {
  await play(page)
  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }
  await expect(page.getByText('Результат')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Вийти' })).toHaveCount(0)
})
