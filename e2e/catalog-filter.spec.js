import { test, expect } from '@playwright/test'
import { GAMES, CATEGORIES } from '../src/data/games.js'

const MEMORY = GAMES.filter((game) => game.category === 'memory').length

test.describe('вибір навику', () => {
  /**
   * Чотири слова під кнопкою на головній виглядали як кнопки, але нічого не
   * робили. Тепер кожне веде до ігор саме на цей навик.
   */
  test('плитка на головній веде до ігор цього навику', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: CATEGORIES.memory.label }).click()

    await expect(page).toHaveURL(/\/games\?category=memory$/)
    await expect(page.locator('.game-card')).toHaveCount(MEMORY)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(CATEGORIES.memory.label)
  })

  /**
   * Фільтр у адресі, а не в стані: посилання можна переслати колезі або лишити
   * в закладках, і воно відкриє те саме.
   */
  test('адресу з навиком можна відкрити напряму', async ({ page }) => {
    await page.goto('/games?category=memory')

    await expect(page.locator('.game-card')).toHaveCount(MEMORY)
    for (const card of await page.locator('.game-card').all()) {
      await expect(card).toContainText(CATEGORIES.memory.label)
    }
  })

  test('кнопка «назад» повертає до попереднього вибору', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('navigation', { name: 'Фільтр за навиком' })
      .getByRole('link', { name: CATEGORIES.attention.label })
      .click()
    await expect(page).toHaveURL(/category=attention/)

    await page.goBack()

    await expect(page).toHaveURL(/\/games$/)
    await expect(page.locator('.game-card')).toHaveCount(GAMES.length)
  })

  test('«Усі» повертає повний каталог', async ({ page }) => {
    await page.goto('/games?category=reaction')
    const filters = page.getByRole('navigation', { name: 'Фільтр за навиком' })

    await filters.getByRole('link', { name: /Усі/ }).click()

    await expect(page.locator('.game-card')).toHaveCount(GAMES.length)
  })

  // Невідомий навик приходить зі старої закладки або з чужого повідомлення.
  test('невідомий навик не лишає порожньої сторінки', async ({ page }) => {
    await page.goto('/games?category=вигаданий')

    await expect(page.locator('.game-card')).toHaveCount(GAMES.length)
  })
})

/**
 * Фонове фото — картинка з власними краями, і поки їй задавали фіксовану
 * ширину, на широкому екрані її межа читалася вертикальною лінією через усю
 * сторінку. Цей тест міряє саме межу: середню яскравість кожної колонки
 * пікселів і найбільший стрибок між сусідніми. Рівний градієнт дає частки
 * одиниці, різкий край — одиниці.
 */
test.describe('фон без швів', () => {
  for (const width of [1600, 1920]) {
    test(`на ${width}px немає вертикального краю`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/')
      // Лишаємо тільки шар фото: текст і блоби дають власні різкі переходи.
      await page.addStyleTag({
        content: '.app-content,.decor__blob,.decor__icon-wrap,.decor__grid{display:none!important}',
      })
      await page.waitForTimeout(300)

      const shot = (await page.screenshot()).toString('base64')
      const worst = await page.evaluate(
        (data) =>
          new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0)
              const rows = 700
              const pixels = ctx.getImageData(0, 100, img.width, rows).data
              const means = new Float64Array(img.width)
              for (let x = 0; x < img.width; x++) {
                let sum = 0
                for (let y = 0; y < rows; y++) {
                  const i = (y * img.width + x) * 4
                  sum += pixels[i] + pixels[i + 1] + pixels[i + 2]
                }
                means[x] = sum / rows / 3
              }
              let best = { jump: 0, x: 0 }
              for (let x = 1; x < img.width; x++) {
                const jump = Math.abs(means[x] - means[x - 1])
                if (jump > best.jump) best = { jump, x }
              }
              resolve(best)
            }
            img.src = 'data:image/png;base64,' + data
          }),
        shot,
      )

      // Виміряно: із фіксованою шириною фото стрибок був 1.4 на 1600 px і 4.3
      // на 1920, рівно на x = ширина − 1500. Без неї лишається шум близько 0.8.
      expect(
        worst.jump,
        `найбільший стрибок ${worst.jump.toFixed(2)} на x=${worst.x} (край фото стояв би на x=${width - 1500})`,
      ).toBeLessThan(1.1)
    })
  }
})
