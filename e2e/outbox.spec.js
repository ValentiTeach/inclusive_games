import { test, expect } from '@playwright/test'

/**
 * Черга на відправку результатів.
 *
 * Сценарій, заради якого вона з'явилась: учень грає на шкільному Wi-Fi, який
 * саме відпав. Досі така спроба не доходила до вчителя ніколи — запит
 * відправлявся один раз, помилку ніхто не читав, а перенесення історії після
 * першого входу вже не повторювалось.
 *
 * Мережа тут вимикається не цілком, а лише для Supabase: так застосунок
 * вантажиться як завжди, а «зв'язку немає» саме там, де він потрібен. Сесія
 * учня кладеться прямо в localStorage — так само, як у support/teacher.js.
 */

const STUDENT_ID = '22222222-3333-4444-8555-666666666666'
const OUTBOX_KEY = 'inclusive-games:outbox'

const SESSION = {
  access_token: 'e2e.fake.token',
  refresh_token: 'e2e-fake-refresh',
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: STUDENT_ID,
    aud: 'authenticated',
    role: 'authenticated',
    is_anonymous: true,
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
  },
}

/**
 * @returns стан «мережі» і все, що дійшло до сервера. online можна перемикати
 *          посеред тесту — маршрутизатор читає його на кожен запит.
 */
async function signInAsStudent(page, { online = true, queued = [] } = {}) {
  const net = { online, inserted: [], rated: [] }

  await page.addInitScript(
    ([session, key, items]) => {
      // Тільки на першому завантаженні: інакше перехід на іншу сторінку
      // щоразу повертав би в чергу те, що вже пішло.
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.setItem('sb-e2e-auth-token', JSON.stringify(session))
      if (items.length) localStorage.setItem(key, JSON.stringify(items))
    },
    [SESSION, OUTBOX_KEY, queued],
  )

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 204, contentType: 'application/json', body: '' }),
  )

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/rest/v1/', '')

    // Профіль потрібен завжди — без нього застосунок не знає, що це учень.
    // Його мережа тут не цікавить: перевіряється саме доставка результатів.
    if (path === 'profiles') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ display_name: 'Оля', group_id: 'g1', role: 'student' }]),
      })
      return
    }

    if (!net.online) {
      await route.abort('internetdisconnected')
      return
    }

    if (path === 'results' && request.method() === 'POST') {
      net.inserted.push(JSON.parse(request.postData() ?? '{}'))
      await route.fulfill({ status: 201, contentType: 'application/json', body: '' })
      return
    }

    if (path === 'rpc/rate_attempt') {
      net.rated.push(JSON.parse(request.postData() ?? '{}'))
      await route.fulfill({ status: 204, contentType: 'application/json', body: '' })
      return
    }

    if (path === 'results') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          net.inserted.map((row) => ({ ...row, felt: null })),
        ),
      })
      return
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  return net
}

async function playOddOneOut(page) {
  await page.goto('/games/odd-one-out')
  await page.getByRole('button', { name: 'Почати' }).click()
  await page.waitForSelector('.odd__item')

  for (let i = 0; i < 12; i++) {
    if ((await page.locator('.odd__item').count()) === 0) break
    await page.locator('.odd__item').first().click()
    await page.waitForTimeout(700)
  }

  await expect(page.getByText('Як тобі було?')).toBeVisible()
}

function readOutbox(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), OUTBOX_KEY)
}

function queuedResult(date) {
  return {
    id: `seed-${date}`,
    kind: 'result',
    userId: STUDENT_ID,
    gameId: 'schulte',
    playedAt: date,
    row: {
      game_id: 'schulte',
      score: 72,
      entries: [],
      metrics: { total: 25 },
      level_id: 'classic',
      played_at: date,
    },
  }
}

test.describe('черга на відправку результатів', () => {
  test('гра без мережі чекає в черзі й доходить, коли мережа повертається', async ({
    page,
  }) => {
    const net = await signInAsStudent(page, { online: false })

    await playOddOneOut(page)
    await page.getByRole('button', { name: 'Важко' }).click()

    // Спроба й оцінка чекають, і оцінка стоїть за своєю спробою.
    await expect.poll(async () => (await readOutbox(page)).map((item) => item.kind)).toEqual([
      'result',
      'rating',
    ])
    expect(net.inserted).toEqual([])

    // Дитина бачить свою гру одразу, не чекаючи хмари, — а не «ще немає
    // жодної зіграної гри».
    await page.goto('/progress')
    await expect(page.locator('.progress-game')).toHaveCount(1)
    await expect(page.getByRole('status')).toContainText('1 гра ще не надіслана')
    // supabase-js сам повторює GET тричі (1 + 2 + 4 с), перш ніж здатися.
    await expect(page.getByRole('status')).toContainText('Немає зв’язку з хмарою', {
      timeout: 15_000,
    })
    await expect(page.getByRole('status')).toContainText('1 гра ще не надіслана')
    await expect(page.locator('.progress-game')).toHaveCount(1)

    net.online = true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect.poll(() => net.inserted.length).toBe(1)
    expect(net.inserted[0]).toMatchObject({ user_id: STUDENT_ID, game_id: 'odd-one-out' })
    await expect.poll(() => net.rated.length).toBe(1)
    expect(net.rated[0]).toMatchObject({ p_game_id: 'odd-one-out', p_felt: 'hard' })

    await expect.poll(() => readOutbox(page)).toEqual([])
    // Лічильник тане на очах, а сама гра з екрана не зникає.
    await expect(page.getByText(/ще не надіслан/)).toHaveCount(0)
    await expect(page.locator('.progress-game')).toHaveCount(1)
  })

  test('з мережею гра йде одразу й у черзі не затримується', async ({ page }) => {
    const net = await signInAsStudent(page)

    await playOddOneOut(page)

    await expect.poll(() => net.inserted.length).toBe(1)
    await expect.poll(() => readOutbox(page)).toEqual([])
  })

  test('те, що чекало з минулого разу, йде одразу після входу', async ({ page }) => {
    const net = await signInAsStudent(page, {
      queued: [queuedResult('2026-09-23T09:00:00.000Z')],
    })

    await page.goto('/')

    await expect.poll(() => net.inserted.length).toBe(1)
    expect(net.inserted[0]).toMatchObject({
      user_id: STUDENT_ID,
      played_at: '2026-09-23T09:00:00.000Z',
    })
  })

  test.describe('передача комп’ютера', () => {
    /**
     * Після виходу анонімного учня його ігри вже ніхто не відправить. Тому
     * сторінка не завершує сеанс мовчки, а каже, що саме буде втрачено.
     */
    test('без мережі попереджає, що ігри пропадуть', async ({ page }) => {
      await signInAsStudent(page, {
        online: false,
        queued: [queuedResult('2026-09-23T09:00:00.000Z')],
      })

      await page.goto('/account')
      await page.getByRole('button', { name: /Завершити сеанс/ }).click()

      const alert = page.getByRole('alert')
      await expect(alert).toContainText('1 гра ще не надіслана')
      await expect(alert).toContainText('пропадуть')
      await expect(page).toHaveURL(/\/account$/)

      await page.getByRole('button', { name: 'Все одно завершити' }).click()

      await expect(page).toHaveURL(/\/join$/)
      // Чужі ігри на спільному комп'ютері не лишаються.
      expect(await readOutbox(page)).toEqual([])
    })

    test('мережа повернулась — «спробувати ще раз» відправляє й завершує', async ({ page }) => {
      const net = await signInAsStudent(page, {
        online: false,
        queued: [queuedResult('2026-09-23T09:00:00.000Z')],
      })

      await page.goto('/account')
      await page.getByRole('button', { name: /Завершити сеанс/ }).click()
      await expect(page.getByRole('alert')).toBeVisible()

      net.online = true
      await page.getByRole('button', { name: 'Спробувати надіслати ще раз' }).click()

      await expect(page).toHaveURL(/\/join$/)
      expect(net.inserted).toHaveLength(1)
    })

    test('з мережею передача не питає зайвого', async ({ page }) => {
      const net = await signInAsStudent(page, {
        queued: [queuedResult('2026-09-23T09:00:00.000Z')],
      })

      await page.goto('/account')
      await page.getByRole('button', { name: /Завершити сеанс/ }).click()

      await expect(page).toHaveURL(/\/join$/)
      expect(net.inserted).toHaveLength(1)
      await expect(page.getByRole('alert')).toHaveCount(0)
    })
  })
})
