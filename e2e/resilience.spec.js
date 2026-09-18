import { test, expect } from '@playwright/test'

/**
 * Мова сторінки.
 *
 * Стояло lang="en" при повністю українському тексті: зчитувач екрана читав би
 * «Таблиці Шульте» англійською фонетикою — нерозбірливо. Для платформи, що
 * зветься інклюзивною, це не дрібниця.
 */
const PAGES = ['/', '/games', '/progress', '/settings', '/login', '/join', '/games/schulte']

for (const path of PAGES) {
  test(`${path} оголошена українською`, async ({ page }) => {
    await page.goto(path)

    expect(await page.locator('html').getAttribute('lang')).toBe('uk')
  })
}

/**
 * Межа падіння в справжньому браузері.
 *
 * Помилку доводиться влаштовувати самому: жодна сторінка не падає навмисно.
 * Ламається Date.now — його при малюванні використовує «Мій прогрес» (рахунок
 * серії днів) і не використовує шапка. Перша спроба ламала Array.prototype.map,
 * і це виявилося надто широко: на ньому тримається й сама шапка, тож падало все
 * дерево, спрацьовувала зовнішня межа, і тест доводив не те, що стверджував.
 */
async function breakProgressPage(page) {
  await page.addInitScript(() => {
    window.__break = () => {
      Date.now = function broken() {
        throw new Error('навмисне падіння для перевірки межі')
      }
    }
  })
}

/* Історія потрібна, щоб «Мій прогрес» дійшов до рахунку серії, а не спинився
   на «ще немає жодної зіграної гри». */
async function seedHistory(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'inclusive-games:results:schulte',
      JSON.stringify([
        { date: '2026-09-10T10:00:00Z', score: 80, entries: [], levelId: 'classic', metrics: {} },
      ]),
    )
  })
}

test('падіння сторінки не лишає білого екрана', async ({ page }) => {
  await seedHistory(page)
  await breakProgressPage(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.evaluate(() => window.__break())
  await page.getByRole('link', { name: /Мій прогрес/ }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(/Щось пішло не так/)).toBeVisible()
  await expect(page.getByText(/не через тебе/)).toBeVisible()
})

/**
 * Шапка має пережити падіння сторінки — саме заради цього межа стоїть
 * усередині розкладки, а не навколо неї. Якщо забрати з екрана і шапку,
 * дитині нема куди піти, крім як закрити вкладку.
 */
test('після падіння сторінки шапка лишається на місці', async ({ page }) => {
  await seedHistory(page)
  await breakProgressPage(page)

  await page.goto('/')
  await page.evaluate(() => window.__break())
  await page.getByRole('link', { name: /Мій прогрес/ }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.getByRole('link', { name: /Каталог ігор/ })).toBeVisible()
})

/**
 * І цим виходом можна скористатися: перехід на іншу сторінку скидає межу.
 */
test('після падіння можна піти на іншу сторінку', async ({ page }) => {
  await seedHistory(page)
  await breakProgressPage(page)

  await page.goto('/')
  await page.evaluate(() => window.__break())
  await page.getByRole('link', { name: /Мій прогрес/ }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByRole('link', { name: /Каталог ігор/ }).click()

  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Каталог ігор/ })).toBeVisible()
})

test('з екрана падіння є власний вихід до каталогу', async ({ page }) => {
  await seedHistory(page)
  await breakProgressPage(page)

  await page.goto('/')
  await page.evaluate(() => window.__break())
  await page.getByRole('link', { name: /Мій прогрес/ }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  // Звичайне посилання перезавантажує сторінку — і разом із нею зламаний Date.
  await page.getByRole('link', { name: 'До каталогу ігор' }).click()

  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Каталог ігор/ })).toBeVisible()
})
