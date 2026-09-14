import { test, expect } from '@playwright/test'
import { GAMES } from '../src/data/games.js'
import { signInAsTeacher } from './support/teacher.js'
import { config as oddConfig } from '../src/games/odd-one-out/oddOneOut.config.js'
import { config as rowConfig } from '../src/games/continue-row/continueRow.config.js'

/*
 * Чекати треба на саме поле гри, а не на оболонку: .game-shell існує вже під
 * час відліку 3-2-1, і дії, послані одразу після «Почати», йдуть у порожнечу.
 */
async function startGame(page, id, playSelector) {
  await signInAsTeacher(page, { groups: [] })
  await page.goto(`/games/${id}`)
  await page.getByText('Почати', { exact: true }).first().click()
  await expect(page.locator(playSelector).first()).toBeVisible({ timeout: 10000 })
}

test.describe('Зайвий предмет', () => {
  const level = oddConfig.levels[0]

  test('показує чотири фігури і питання', async ({ page }) => {
    await startGame(page, 'odd-one-out', '.odd__item')

    await expect(page.locator('.odd__item')).toHaveCount(4)
    await expect(page.getByText('Яка фігура зайва?')).toBeVisible()
  })

  /**
   * Клітинки однакові навмисно: якби кнопка росла разом із фігурою, найбільша
   * впадала б в око ще до порівняння ознак.
   */
  test('усі клітинки однакового розміру', async ({ page }) => {
    await startGame(page, 'odd-one-out', '.odd__item')

    await expect(page.locator('.odd__item')).toHaveCount(4)
    const sizes = await page.locator('.odd__item').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        return `${Math.round(rect.width)}x${Math.round(rect.height)}`
      }),
    )

    expect(new Set(sizes).size, `розміри: ${sizes.join(', ')}`).toBe(1)
  })

  test('гра доходить до результатів', async ({ page }) => {
    await startGame(page, 'odd-one-out', '.odd__item')

    for (let trial = 0; trial < level.trialCount; trial++) {
      await expect(page.locator('.odd__item')).toHaveCount(4)
      await page.locator('.odd__item').first().click()
      await page.waitForTimeout(700)
    }

    await expect(page.getByText('Точність')).toBeVisible()
  })
})

test.describe('Продовж ряд', () => {
  const level = rowConfig.levels[0]

  test('показує ряд, знак питання і чотири варіанти', async ({ page }) => {
    await startGame(page, 'continue-row', '.row-game__option')

    await expect(page.locator('.row-game__cell')).toHaveCount(level.length + 1)
    await expect(page.locator('.row-game__cell--next')).toHaveText('?')
    await expect(page.locator('.row-game__option')).toHaveCount(4)
  })

  test('клавіші 1–4 вибирають варіант так само, як клік', async ({ page }) => {
    await startGame(page, 'continue-row', '.row-game__option')

    await page.keyboard.press('1')
    // Після відповіді підсвічується правильний варіант.
    await expect(page.locator('.row-game__option.is-answer')).toHaveCount(1)
  })

  test('гра доходить до результатів', async ({ page }) => {
    await startGame(page, 'continue-row', '.row-game__option')

    for (let trial = 0; trial < level.trialCount; trial++) {
      await expect(page.locator('.row-game__option')).toHaveCount(4)
      await page.keyboard.press('1')
      await page.waitForTimeout(700)
    }

    await expect(page.getByText('Точність')).toBeVisible()
  })
})

test('нові ігри стоять у каталозі в категорії «Мислення»', async ({ page }) => {
  const thinking = GAMES.filter((game) => game.category === 'thinking')
  await page.goto('/games?category=thinking')

  await expect(page.locator('.game-card')).toHaveCount(thinking.length)
  await expect(page.getByText('Зайвий предмет')).toBeVisible()
  await expect(page.getByText('Продовж ряд')).toBeVisible()
})
