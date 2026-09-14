import { test, expect } from '@playwright/test'
import { GAMES } from '../src/data/games.js'
import { signInAsTeacher } from './support/teacher.js'
import { config as vanishedConfig } from '../src/games/what-vanished/whatVanished.config.js'
import { config as spanConfig } from '../src/games/digit-span/digitSpan.config.js'

async function startGame(page, id) {
  await signInAsTeacher(page, { groups: [] })
  await page.goto(`/games/${id}`)
  await page.getByText('Почати', { exact: true }).first().click()
  await expect(page.locator('.game-shell')).toBeVisible()
}

test.describe('Що зникло', () => {
  const level = vanishedConfig.levels[0]

  test('набір показується, зникає і повертається без одного предмета', async ({ page }) => {
    await startGame(page, 'what-vanished')

    await expect(page.locator('.vanished__item')).toHaveCount(level.setSize)
    await expect(page.locator('.vanished__option')).toHaveCount(0)

    // Показ, потім порожня мить, потім питання.
    await expect(page.locator('.vanished__option')).toHaveCount(4, { timeout: 10000 })
    await expect(page.locator('.vanished__item')).toHaveCount(level.setSize - 1)
  })

  test('набір не змінює висоти, коли предмет зникає', async ({ page }) => {
    await startGame(page, 'what-vanished')

    const set = page.locator('.vanished__set')
    const before = (await set.boundingBox()).height
    await expect(page.locator('.vanished__option')).toHaveCount(4, { timeout: 10000 })
    const after = (await set.boundingBox()).height

    /*
     * Це перевірка рендера, а не формули: саму властивість тримає форма сітки
     * (див. whatVanished.test.jsx), а тут видно, що вона доживає до екрана.
     */
    expect(after).toBeCloseTo(before, 0)
  })

  test('гра доходить до результатів', async ({ page }) => {
    await startGame(page, 'what-vanished')

    for (let trial = 0; trial < level.trialCount; trial++) {
      await expect(page.locator('.vanished__option')).toHaveCount(4, { timeout: 10000 })
      await page.locator('.vanished__option').first().click()
      await page.waitForTimeout(800)
    }

    await expect(page.getByText('Предметів у наборі')).toBeVisible()
  })
})

test.describe('Послідовність цифр', () => {
  const level = spanConfig.levels[0]

  test('цифри показуються по одній, потім зʼявляється клавіатура', async ({ page }) => {
    await startGame(page, 'digit-span')

    await expect(page.locator('.span__digit')).toHaveCount(1)
    await expect(page.locator('.span__keypad')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.span__key')).toHaveCount(10)
  })

  test('набране видно на екрані, і Backspace його стирає', async ({ page }) => {
    await startGame(page, 'digit-span')
    await expect(page.locator('.span__keypad')).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('1')
    await page.keyboard.press('2')
    await expect(page.locator('.span__typed')).toHaveText('1 2')

    await page.keyboard.press('Backspace')
    await expect(page.locator('.span__typed')).toHaveText('1')
  })

  /**
   * Головне в цій грі: ряд довшає, поки дитина справляється. Відповідь тут
   * читається з екрана так само, як її запам'ятовує дитина.
   */
  test('після правильної відповіді ряд стає довшим', async ({ page }) => {
    await startGame(page, 'digit-span')

    const digits = []
    for (let i = 0; i < level.startLength; i++) {
      await expect(page.locator('.span__digit')).not.toHaveText('', { timeout: 4000 })
      digits.push(await page.locator('.span__digit').textContent())
      // Чекаємо, поки цифра зміниться на порожню мить.
      await page.waitForTimeout(900)
    }

    await expect(page.locator('.span__keypad')).toBeVisible({ timeout: 6000 })
    for (const digit of digits) await page.keyboard.press(digit)
    await page.keyboard.press('Enter')

    await expect(page.locator('.span__progress')).toContainText(
      `Ряд із ${level.startLength + 1} цифр`,
      { timeout: 6000 },
    )
  })
})

test('нові ігри стоять у каталозі в категорії «Пам’ять»', async ({ page }) => {
  const memory = GAMES.filter((game) => game.category === 'memory')
  await page.goto('/games?category=memory')

  await expect(page.locator('.game-card')).toHaveCount(memory.length)
  await expect(page.getByText('Що зникло')).toBeVisible()
  await expect(page.getByText('Послідовність цифр')).toBeVisible()
})
