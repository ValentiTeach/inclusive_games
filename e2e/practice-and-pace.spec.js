import { test, expect } from '@playwright/test'

/*
 * Пробна гра, «без поспіху» і озвучення — на справжній грі в браузері.
 * Шульте, бо вона відкрита гостю і має обидві речі, які змінює темп: секундомір
 * на екрані і бал за час.
 */
const GAME = '/games/schulte'

function historyOf(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('inclusive-games:results:schulte') ?? '[]'),
  )
}

async function clickNumbersUpTo(page, total) {
  for (let number = 1; number <= total; number++) {
    await page.locator('.schulte__cell', { hasText: new RegExp(`^${number}$`) }).click()
  }
}

test('пробна гра — коротка, з підказкою і не записується', async ({ page }) => {
  await page.goto(GAME)
  await expect(page.getByText(/бали в ній не рахуються/)).toBeVisible()

  await page.getByRole('button', { name: 'Спершу спробувати' }).click()
  await expect(page.getByRole('note', { name: 'Пробна гра' })).toContainText('по порядку')

  await expect(page.locator('.schulte__cell')).toHaveCount(9)
  await clickNumbersUpTo(page, 9)

  await expect(page.getByRole('heading', { name: 'Пробну гру завершено' })).toBeVisible()
  expect(await historyOf(page)).toEqual([])

  await page.getByRole('button', { name: 'Почати гру' }).click()
  await expect(page.locator('.schulte__cell')).toHaveCount(16)
  await expect(page.getByRole('note', { name: 'Пробна гра' })).toHaveCount(0)
})

test('без поспіху: секундомір сховано, спробу позначено', async ({ page }) => {
  await page.goto(GAME)

  const toggle = page.getByRole('button', { name: 'Без поспіху' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/лише за помилками/)).toBeVisible()

  await page.getByRole('button', { name: 'Почати' }).click()
  await expect(page.locator('.schulte__cell')).toHaveCount(16)
  await expect(page.locator('.schulte__timer')).toHaveCount(0)

  await clickNumbersUpTo(page, 16)

  await expect(page.getByText('Без поспіху')).toBeVisible()
  const [attempt] = await historyOf(page)
  expect(attempt.metrics.relaxed_pace).toBe(true)
  // Без помилок і без штрафу за час — повний бал, хоч би скільки тривала гра.
  expect(attempt.score).toBe(100)
})

test.describe('озвучення', () => {
  /*
   * Голос підміняється: у безголовому браузері голосів немає, а перевіряємо ми
   * не синтезатор, а те, що саме й коли йому дають.
   */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__spoken = []
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text
        }
      }
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          getVoices: () => [{ name: 'Lesya', lang: 'uk-UA', localService: true }],
          speak(utterance) {
            window.__spoken.push(utterance.text)
            utterance.onstart?.()
            setTimeout(() => utterance.onend?.(), 50)
          },
          cancel() {},
          addEventListener() {},
          removeEventListener() {},
        },
      })
    })
  })

  test('«Послухати» читає опис і інструкцію', async ({ page }) => {
    await page.goto(GAME)
    await page.getByRole('button', { name: 'Послухати' }).click()

    const spoken = await page.evaluate(() => window.__spoken)
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toContain('Натискай на числа по порядку')
  })

  test('«Автоматично» читає інструкцію і підказку проби без натискань', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('inclusive-games:settings', JSON.stringify({ voice: 'auto' }))
    })
    await page.goto(GAME)
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)

    await page.getByRole('button', { name: 'Спершу спробувати' }).click()
    await expect
      .poll(() => page.evaluate(() => window.__spoken.at(-1)))
      .toContain('Знайди 1')
  })
})
