import { test, expect } from '@playwright/test'
import { GAMES } from '../src/data/games.js'
import { signInAsTeacher } from './support/teacher.js'

/**
 * Дві нові гри категорії «Реакція» — пройдені до кінця в справжньому браузері.
 * Модульні тести перевіряють арифметику, тут перевіряється, що дитина взагалі
 * може дійти від кнопки «Почати» до екрана результатів.
 */
async function startGame(page, id) {
  await signInAsTeacher(page, { groups: [] })
  await page.goto(`/games/${id}`)
  await page.getByText('Почати', { exact: true }).first().click()
  // Відлік 3-2-1 по 700 мс
  await expect(page.locator('.game-shell')).toBeVisible()
}

test.describe('Світлофор', () => {
  test('гра доходить до результатів і показує всі виміри', async ({ page }) => {
    await startGame(page, 'traffic-light')

    const level = { rounds: 8 }
    for (let round = 0; round < level.rounds; round++) {
      // Вогонь загоряється через 0.9–3 с після початку раунду.
      const lit = page.locator('.traffic__lamp.is-lit')
      await expect(lit).toBeVisible({ timeout: 6000 })

      const index = await page.locator('.traffic__lamp').evaluateAll((lamps) =>
        lamps.findIndex((lamp) => lamp.classList.contains('is-lit')),
      )
      await page.locator('.traffic__button').nth(index).click()
      await expect(page.locator('.traffic__status')).toContainText('Точно!')
      await expect(lit).toBeHidden({ timeout: 4000 })
    }

    await expect(page.getByText('Точність')).toBeVisible()
    await expect(page.getByText('Натиснув зарано')).toBeVisible()
  })

  test('до сигналу жоден вогонь не горить', async ({ page }) => {
    await startGame(page, 'traffic-light')

    await expect(page.locator('.traffic__status')).toContainText('Чекай…')
    await expect(page.locator('.traffic__lamp.is-lit')).toHaveCount(0)
  })

  test('перший рівень має рівно два вогні', async ({ page }) => {
    await startGame(page, 'traffic-light')

    await expect(page.locator('.traffic__lamp')).toHaveCount(2)
    await expect(page.locator('.traffic__button')).toHaveCount(2)
  })
})

test.describe('Лови момент', () => {
  test('бігунець справді рухається, поки його не зупинили', async ({ page }) => {
    await startGame(page, 'catch-the-moment')
    const marker = page.locator('.catch__marker')
    await expect(marker).toBeVisible()

    const readLeft = () => marker.evaluate((node) => parseFloat(node.style.left))
    const first = await readLeft()
    await page.waitForTimeout(250)
    const second = await readLeft()

    expect(Math.abs(second - first), 'бігунець мав зрушити з місця').toBeGreaterThan(1)
  })

  test('пробіл зупиняє бігунець, і далі він стоїть', async ({ page }) => {
    await startGame(page, 'catch-the-moment')
    const marker = page.locator('.catch__marker')
    await expect(marker).toBeVisible()

    await page.keyboard.press('Space')
    await expect(marker).toHaveClass(/is-stopped/)

    const stoppedAt = await marker.evaluate((node) => parseFloat(node.style.left))
    await page.waitForTimeout(200)
    const stillThere = await marker.evaluate((node) => parseFloat(node.style.left))

    expect(stillThere).toBeCloseTo(stoppedAt, 5)
  })

  test('гра доходить до результатів', async ({ page }) => {
    await startGame(page, 'catch-the-moment')

    for (let round = 0; round < 6; round++) {
      await expect(page.locator('.catch__marker')).toBeVisible()
      await page.keyboard.press('Space')
      await expect(page.locator('.catch__marker.is-stopped')).toBeVisible()
      await page.waitForTimeout(800)
    }

    await expect(page.getByText('Влучань')).toBeVisible()
    await expect(page.getByText('Середнє відхилення')).toBeVisible()
  })
})

test('нові ігри стоять у каталозі в категорії «Реакція»', async ({ page }) => {
  const reaction = GAMES.filter((game) => game.category === 'reaction')
  await page.goto('/games?category=reaction')

  await expect(page.locator('.game-card')).toHaveCount(reaction.length)
  await expect(page.getByText('Світлофор')).toBeVisible()
  await expect(page.getByText('Лови момент')).toBeVisible()
})
