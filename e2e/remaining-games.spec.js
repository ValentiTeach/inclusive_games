import { test, expect } from '@playwright/test'
import { signInAsTeacher } from './support/teacher'

/*
 * Вісім ігор, які досі не мали жодного E2E.
 *
 * Це не недогляд: ці ігри не безкоштовні для гостя (freeForGuests у
 * src/data/games.js), і GamePage перекидає гостя на /login. Решта спеків
 * ходили гостем — тож саме ці вісім і лишилися неперевіреними. Тут вхід
 * підміняється тим самим хелпером, що й для вчительських сторінок.
 *
 * Перевіряються дві речі, які ламаються найчастіше і найтихіше:
 * гра доходить до екрана результату, і спроба справді їде на сервер з
 * правильним game_id. Друге важливе окремо: гра може малюватися бездоганно
 * й нічого не записати — дитина грала, вчитель не бачить нічого.
 */

const GAMES = [
  // option: null — гра сама йде за таймером, натискання необовʼязкове.
  { id: 'stroop', option: '.stroop__option' },
  { id: 'quick-math', option: '.quick-math__option' },
  { id: 'matrices', option: '.matrices__option' },
  { id: 'mental-rotation', option: '.mental-rotation__option' },
  { id: 'subitizing', option: '.subitizing__option' },
  { id: 'target-search', option: '.target-search__item' },
  { id: 'go-no-go', option: null },
  { id: 'n-back', option: null },
]

async function start(page, gameId) {
  await page.goto(`/games/${gameId}`)
  await page.getByText('Почати', { exact: true }).first().click()
}

/**
 * Клікає, поки не зʼявиться екран результату. Таймер-ігри просто дочікуються.
 * Повертає true, якщо результат зʼявився.
 */
async function playThrough(page, optionSelector, timeoutMs = 75_000) {
  const results = page.getByRole('heading', { name: 'Результат' })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await results.isVisible().catch(() => false)) return true
    if (optionSelector) {
      const option = page.locator(optionSelector).first()
      if (await option.isVisible().catch(() => false)) {
        await option.click({ force: true, timeout: 1000 }).catch(() => {})
      }
    }
    await page.waitForTimeout(200)
  }
  return false
}

// N-back — 24 проби по 2 с, майже хвилина; стандартних 30 с Playwright не
// вистачає. Внутрішній дедлайн playThrough менший за цей — щоб тест падав на
// зрозумілому твердженні, а не на таймауті самого Playwright.
const TEST_TIMEOUT_MS = 90_000

for (const game of GAMES) {
  test(`${game.id}: гра доходить до результату`, async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    await signInAsTeacher(page, { groups: [] })
    await start(page, game.id)

    expect(await playThrough(page, game.option)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Результат' })).toBeVisible()
    await expect(page.getByText('Точність')).toBeVisible()
  })

  test(`${game.id}: спроба їде на сервер`, async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    await signInAsTeacher(page, { groups: [] })

    // Реєструється після signInAsTeacher — Playwright бере останній доданий
    // обробник, тож POST спершу потрапляє сюди, а fallback віддає його назад
    // хелперу, який і відповідає замість PostgREST.
    const saved = []
    await page.route('**/rest/v1/results*', async (route) => {
      if (route.request().method() === 'POST') {
        saved.push(JSON.parse(route.request().postData() ?? '{}'))
      }
      await route.fallback()
    })

    await start(page, game.id)
    expect(await playThrough(page, game.option)).toBe(true)

    await expect.poll(() => saved.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const row = saved[0]
    expect(row.game_id).toBe(game.id)
    expect(typeof row.score).toBe('number')
    expect(row.metrics).toBeTruthy()
  })
}
