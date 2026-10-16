import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher.js'

async function startGame(page, id) {
  await signInAsTeacher(page, { groups: [] })
  await page.goto(`/games/${id}`)
  await page.getByText('Почати', { exact: true }).first().click()
  await expect(page.locator('.game-play')).toBeVisible({ timeout: 10000 })
}

test.describe('режим високої контрастності (forced-colors)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
  })

  /*
   * У Струпі колір і є завданням. Якби система перефарбувала зразки у свій
   * один колір, гру не можна було б пройти взагалі.
   */
  test('ігрове поле зберігає кольори, що несуть зміст', async ({ page }) => {
    await startGame(page, 'stroop')

    const swatches = await page
      .locator('.stroop__swatch')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor))
    expect(new Set(swatches).size).toBe(swatches.length)

    const adjust = await page.locator('.game-play').evaluate((node) => getComputedStyle(node).forcedColorAdjust)
    expect(adjust).toBe('none')
  })

  // Вибраний варіант у налаштуваннях позначений тлом — у цьому режимі тла
  // немає, тож має бути рамка.
  test('вибраний перемикач видно без кольору тла', async ({ page }) => {
    await page.goto('/settings')
    const active = page.locator('[aria-pressed="true"], .is-active').first()
    await expect(active).toBeVisible()
    const outline = await active.evaluate((node) => getComputedStyle(node).outlineStyle)
    expect(outline).not.toBe('none')
  })
})

test('підвищений контраст робить приглушений текст повним', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' })
  await page.goto('/help')

  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return { text: root.getPropertyValue('--text').trim(), muted: root.getPropertyValue('--text-muted').trim() }
  })
  expect(colors.muted).toBe(colors.text)
})

test.describe('підбір ігор під дитину', () => {
  // Гість бачить закриті картки як посилання на вхід, тож картки шукаються за
  // назвою, а не за адресою гри.
  const card = (page, title) => page.locator('.game-card', { hasText: title })

  test('«Не чує» ховає ігри на слух і лишає це в адресі', async ({ page }) => {
    await page.goto('/games')
    await expect(card(page, 'Слухай і лови')).toBeVisible()

    await page.getByRole('button', { name: 'Не чує або погано чує' }).click()

    await expect(page).toHaveURL(/without=hearing/)
    await expect(page.getByRole('button', { name: 'Не чує або погано чує' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const title of ['Слухай і лови', 'Ритм', 'Перший звук', 'Десять слів']) {
      await expect(card(page, title)).toHaveCount(0)
    }
    await expect(card(page, 'Таблиці Шульте')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Сховано ігор: 4')

    // Навик зберігає вибір «без слуху».
    await page.locator('.catalog-filter', { hasText: "Пам'ять" }).click()
    await expect(page).toHaveURL(/category=memory/)
    await expect(page).toHaveURL(/without=hearing/)
    await expect(card(page, 'Десять слів')).toHaveCount(0)
    await expect(card(page, 'Знайди пару')).toBeVisible()
  })

  test('картка гри каже, що вона вимагає', async ({ page }) => {
    await page.goto('/games')
    const needs = card(page, 'Слухай і лови').getByRole('list', { name: 'Що потрібно для гри' })
    await expect(needs).toContainText('Потрібен слух')
    await expect(needs).toContainText('Є обмеження часу')
  })
})

/*
 * Струп сам нічого не озвучує. Оболонка гри ловить playCorrect/playWrong і
 * каже результат проби в живому регіоні — для дитини з екранним читачем.
 */
test('результат проби озвучується в грі без власного озвучення', async ({ page }) => {
  await startGame(page, 'stroop')

  const announcer = page.locator('.game-play__announce')
  await expect(announcer).toHaveAttribute('aria-live', 'polite')
  await page.locator('.stroop__option').first().click()
  await expect(announcer).toHaveText(/Правильно\.|Не так\./)
})
