import { test, expect } from '@playwright/test'

/**
 * Показники на сторінці «Мій прогрес».
 *
 * Історія гостя лежить у localStorage, тож сесія тут не потрібна: досить
 * покласти кілька спроб так само, як їх кладе сама гра.
 */
const KEY = 'inclusive-games:results:'

function attempt(score, metrics, date) {
  return { score, entries: [], metrics, levelId: 'classic', date }
}

test.describe('мій прогрес', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([key, history]) => {
        localStorage.setItem(key + 'reaction-time', JSON.stringify(history))
      },
      [
        KEY,
        /*
         * Рекорд навмисно стоїть НЕ в найновішій спробі: якби він був
         * останнім, підміна «брати показники лише з останньої спроби» пройшла б
         * непоміченою — саме так і сталося з першою версією цієї фікстури.
         */
        [
          attempt(70, { total: 8, rt_count: 8, avg_rt_ms: 420, best_rt_ms: 402 }, '2026-09-05T10:00:00Z'),
          attempt(66, { total: 8, rt_count: 8, avg_rt_ms: 430, best_rt_ms: 355 }, '2026-09-04T10:00:00Z'),
          attempt(40, { total: 8, rt_count: 8, avg_rt_ms: 700, best_rt_ms: 640 }, '2026-09-03T10:00:00Z'),
          attempt(30, { total: 8, rt_count: 8, avg_rt_ms: 800, best_rt_ms: 700 }, '2026-09-02T10:00:00Z'),
        ],
      ],
    )
  })

  /**
   * Сенс зміни: показники, які гра міряє від самого початку, дитина вперше
   * бачить у себе на сторінці.
   */
  test('картка гри показує рекорд, а не лише бал', async ({ page }) => {
    await page.goto('/progress')

    const card = page.locator('.progress-game').first()
    await expect(card).toBeVisible()
    await expect(card.locator('.progress-game__metrics')).toBeVisible()

    // Рекорд стоїть першим: дитині він цікавіший за середнє.
    await expect(card.locator('.progress-game__metric').first()).toContainText('Найкращий час')
    await expect(card.locator('.progress-game__metric').first()).toContainText('355 мс')
  })

  test('рекорд береться з усієї історії, а не з останньої спроби', async ({ page }) => {
    await page.goto('/progress')

    // Дочікуємося картки, перш ніж читати. allTextContents() не повторює спроб,
    // і на порожній ще сторінці повертає [] — а на порожньому рядку
    // not.toContain('402') істинне саме собою. Тобто без цього очікування
    // половина перевірки тихо перетворювалася б на ніщо. Сторінка приїжджає
    // окремим шматком, тож мить порожнечі після переходу тепер є завжди.
    await expect(page.locator('.progress-game__metric dd').first()).toBeVisible()

    const values = (await page.locator('.progress-game__metric dd').allTextContents()).join(' ')

    // 355 — найкращий час із передостанньої спроби; 402 — з найновішої.
    expect(values).toContain('355')
    expect(values).not.toContain('402')
  })

  test('поступ показується, коли спроб достатньо', async ({ page }) => {
    await page.goto('/progress')

    await expect(page.locator('.progress-game__growth')).toContainText('+')
  })

  test('на телефоні картка не їде вбік', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/progress')

    await expect(page.locator('.progress-game__metrics')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
  })
})

test('без історії сторінка не показує порожніх показників', async ({ page }) => {
  await page.goto('/progress')

  await expect(page.locator('.progress-game__metrics')).toHaveCount(0)
})
