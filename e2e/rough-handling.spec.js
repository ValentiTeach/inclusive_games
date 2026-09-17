import { test, expect } from '@playwright/test'

/**
 * Що робить дитина, а не тестувальник.
 *
 * Досі перевірялися правильні шляхи: натиснув «Почати», зіграв, побачив
 * результат. Дитина тисне двічі, бо не зрозуміла, чи спрацювало; кидає гру
 * посеред; гатить по кнопці; повертає телефон; втрачає мережу. Нижче — саме це.
 */

const GAME = '/games/odd-one-out'

async function start(page, path = GAME) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Почати' }).click()
}

function historyOf(page, gameId) {
  return page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`inclusive-games:results:${id}`) ?? '[]'),
    gameId,
  )
}

test('подвійне натискання «Почати» не запускає дві гри', async ({ page }) => {
  await page.goto(GAME)
  const button = page.getByRole('button', { name: 'Почати' })

  await button.click({ clickCount: 2, delay: 20 })
  await page.waitForSelector('.odd__item')

  // Один набір карток, а не два накладені.
  await expect(page.locator('.odd__item')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Почати' })).toHaveCount(0)
})

test('кинута посеред гра не лишає по собі спроби', async ({ page }) => {
  await start(page)
  await page.waitForSelector('.odd__item')
  await page.locator('.odd__item').first().click()
  await page.waitForTimeout(400)

  await page.goto('/games')

  expect(await historyOf(page, 'odd-one-out')).toEqual([])
})

test('перезавантаження посеред гри повертає до початку, а не до зламаного екрана', async ({
  page,
}) => {
  await start(page)
  await page.waitForSelector('.odd__item')
  await page.locator('.odd__item').first().click()
  await page.waitForTimeout(400)

  await page.reload()

  await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
  expect(await historyOf(page, 'odd-one-out')).toEqual([])
})

/**
 * Дитина гатить по тій самій картці, поки та не зникне. Кожен удар не має
 * рахуватися за окрему відповідь: інакше одна проба псує всю статистику.
 */
test('серія ударів по одній картці не рахується як багато відповідей', async ({ page }) => {
  await start(page)
  await page.waitForSelector('.odd__item')

  const card = page.locator('.odd__item').first()
  for (let i = 0; i < 6; i += 1) {
    await card.click({ force: true }).catch(() => {})
  }
  await page.waitForTimeout(900)

  // Гра пішла далі рівно на одну пробу, а не на шість.
  const progress = await page.evaluate(
    () => document.body.innerText.match(/(\d+)\s*\/\s*(\d+)/)?.[0] ?? null,
  )
  expect(progress).not.toBeNull()
  const [done, total] = progress.split('/').map((part) => Number(part.trim()))
  expect(done).toBeLessThanOrEqual(2)
  expect(total).toBeGreaterThan(1)
})

test('клавіші до початку гри нічого не ламають', async ({ page }) => {
  await page.goto(GAME)

  for (const key of ['1', '2', '3', '4', 'Space', 'Enter']) {
    await page.keyboard.press(key)
  }

  await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
  expect(await historyOf(page, 'odd-one-out')).toEqual([])
})

/**
 * Найважливіше з усього: мережа пропала посеред гри. Спроба дитини має лягти
 * локально й показатися на екрані, навіть якщо в хмару вона не доїхала.
 */
test('втрата мережі посеред гри не з’їдає результат', async ({ page, context }) => {
  await start(page)
  await page.waitForSelector('.odd__item')

  await context.setOffline(true)

  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }

  await expect(page.getByText('Результат')).toBeVisible()
  expect(await historyOf(page, 'odd-one-out')).toHaveLength(1)

  await context.setOffline(false)
})

test('оцінка складності без мережі зберігається локально', async ({ page, context }) => {
  await start(page)
  await page.waitForSelector('.odd__item')

  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }
  await expect(page.getByText('Як тобі було?')).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Важко' }).click()

  const history = await historyOf(page, 'odd-one-out')
  expect(history[0].felt).toBe('hard')

  await context.setOffline(false)
})

/**
 * Дитина може перемислити. Остання відповідь — правильна, і в історії має
 * лишитися одна спроба, а не три.
 */
test('переклацування оцінки не плодить спроб', async ({ page }) => {
  await start(page)
  await page.waitForSelector('.odd__item')

  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }

  await page.getByRole('button', { name: 'Важко' }).click()
  await page.getByRole('button', { name: 'Легко' }).click()
  await page.getByRole('button', { name: 'Нормально' }).click()

  const history = await historyOf(page, 'odd-one-out')
  expect(history).toHaveLength(1)
  expect(history[0].felt).toBe('ok')
})

/**
 * Зіпсоване сховище трапляється: приватне вікно, обірваний запис, чужа
 * вкладка. Застосунок має відкритися, а не показати білий екран.
 */
test('зіпсована історія в сховищі не валить сторінку', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('inclusive-games:results:odd-one-out', '{зламано')
    localStorage.setItem('inclusive-games:settings', 'теж зламано')
  })

  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Мій прогрес' })).toBeVisible()

  await page.goto(GAME)
  await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
})

/**
 * Приватне вікно може взагалі не дати писати в сховище. Гра має дограти до
 * результату, навіть якщо зберегти його нікуди.
 */
test('гра доходить до результату, коли сховище недоступне', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error('сховище недоступне')
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: boom,
        setItem: boom,
        removeItem: boom,
        key: boom,
        clear: boom,
        get length() {
          return boom()
        },
      },
    })
  })

  await start(page)
  await page.waitForSelector('.odd__item')

  for (let i = 0; i < 12; i += 1) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }

  await expect(page.getByText('Результат')).toBeVisible()
})
