import { test, expect } from '@playwright/test'

/*
 * Історія кладеться прямо в localStorage — так само, як її зберігає гра.
 */
async function seed(page, gameId, attempts) {
  await page.addInitScript(
    ([id, rows]) => {
      localStorage.setItem(`inclusive-games:results:${id}`, JSON.stringify(rows))
    },
    [gameId, attempts],
  )
}

function attempt(overrides) {
  return {
    date: '2026-09-16T10:00:00Z',
    score: 95,
    entries: [],
    levelId: 'small',
    metrics: { total: 5 },
    ...overrides,
  }
}

test.describe('як тобі було', () => {
  test('питання стоїть на екрані результатів і нічого не вимагає', async ({ page }) => {
    await page.goto('/games/odd-one-out')
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.odd__item')

    for (let i = 0; i < 12; i++) {
      if ((await page.locator('.odd__item').count()) === 0) break
      await page.locator('.odd__item').first().click()
      await page.waitForTimeout(700)
    }

    await expect(page.getByText('Як тобі було?')).toBeVisible()
    // Кнопки виходу поруч: питання не перегороджує дорогу.
    await expect(page.getByRole('button', { name: 'Спробувати ще раз' })).toBeVisible()

    await page.getByRole('button', { name: 'Важко' }).click()
    await expect(page.getByRole('button', { name: 'Важко' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('inclusive-games:results:odd-one-out'))[0].felt,
    )
    expect(stored).toBe('hard')
  })

  /**
   * Заради цього все й робилося: слово дитини має міняти те, що буде далі.
   * Бал 95 сам по собі підняв би рівень.
   */
  test('«важко» спиняє підвищення рівня', async ({ page }) => {
    await seed(page, 'schulte', [attempt({ felt: 'hard' })])
    await page.goto('/games/schulte')

    await expect(page.getByRole('button', { name: '4 × 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText(/Рівень підібрано автоматично/)).toHaveCount(0)
  })

  test('без відповіді бал 95 рівень підіймає', async ({ page }) => {
    await seed(page, 'schulte', [attempt()])
    await page.goto('/games/schulte')

    await expect(page.getByRole('button', { name: '5 × 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText(/Рівень підібрано автоматично/)).toBeVisible()
  })

  test('«легко» спиняє зниження рівня', async ({ page }) => {
    await seed(page, 'schulte', [attempt({ score: 20, levelId: 'classic', felt: 'easy' })])
    await page.goto('/games/schulte')

    await expect(page.getByRole('button', { name: '5 × 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

test.describe('режими звуку', () => {
  async function setMode(page, sound) {
    await page.addInitScript((mode) => {
      localStorage.setItem('inclusive-games:settings', JSON.stringify({ sound: mode }))
    }, sound)
  }

  test('налаштування пропонують три режими', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByRole('button', { name: 'Тихо' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Клацання' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Музика' })).toBeVisible()
  })

  test('вибір режиму зберігається', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Музика' }).click()

    await expect(page.getByRole('button', { name: 'Музика' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.reload()
    await expect(page.getByRole('button', { name: 'Музика' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  /**
   * Той, хто вимкнув звук старим перемикачем, не має почути його знову після
   * оновлення застосунку.
   */
  test('старе «вимкнено» лишається тишею', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'inclusive-games:settings',
        JSON.stringify({ soundEnabled: false, theme: 'light' }),
      )
    })
    await page.goto('/settings')

    await expect(page.getByRole('button', { name: 'Тихо' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  /**
   * Фон звучить лише поки триває гра: на екранах вступу й результатів читають.
   *
   * Звуку в тесті не почути, тож замість AudioContext підставляється
   * записувач: він рахує, скільки генераторів створено й скільки зупинено.
   * Перевіряється рішення коду, а не звучання.
   */
  async function recordAudio(page) {
    await page.addInitScript(() => {
      window.__audio = { started: 0, stopped: 0 }
      const param = () => ({
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      })
      window.AudioContext = class {
        constructor() {
          this.state = 'running'
          this.currentTime = 0
          this.destination = {}
        }
        resume() {}
        createOscillator() {
          return {
            type: 'sine',
            frequency: param(),
            detune: param(),
            connect() {},
            start() {
              window.__audio.started += 1
            },
            stop() {
              window.__audio.stopped += 1
            },
          }
        }
        createGain() {
          return { gain: param(), connect() {} }
        }
        createBiquadFilter() {
          return { type: 'lowpass', frequency: param(), connect() {} }
        }
      }
      window.webkitAudioContext = window.AudioContext
    })
  }

  const audio = (page) => page.evaluate(() => window.__audio)

  test('у режимі музики фон запускається з початком гри', async ({ page }) => {
    await setMode(page, 'music')
    await recordAudio(page)
    await page.goto('/games/odd-one-out')

    const beforeStart = await audio(page)
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.odd__item')
    const duringGame = await audio(page)

    // Фон — три голоси; клацання по «Почати» дає щонайбільше один звук.
    expect(duringGame.started - beforeStart.started).toBeGreaterThanOrEqual(3)
    /*
     * Саме скільки звучить просто зараз, а не скільки створено: клацання теж
     * створює генератор, але одразу його й зупиняє, тож «жодного зупиненого»
     * було б неправдою вже після першої кнопки.
     */
    expect(duringGame.started - duringGame.stopped).toBeGreaterThanOrEqual(3)
  })

  test('фон змовкає, коли гра скінчилася', async ({ page }) => {
    await setMode(page, 'music')
    await recordAudio(page)
    await page.goto('/games/odd-one-out')
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.odd__item')

    for (let i = 0; i < 12; i++) {
      if ((await page.locator('.odd__item').count()) === 0) break
      await page.locator('.odd__item').first().click()
      await page.waitForTimeout(700)
    }
    await expect(page.getByText('Як тобі було?')).toBeVisible()

    /*
     * Скільки голосів лишилося живими, а не скільки зупинок сталося: дванадцять
     * клацань за гру самі дають дванадцять зупинок, і перевірка «зупинок
     * щонайменше три» проходила б навіть тоді, коли фон грає далі. Саме на цьому
     * мутація й вижила першого разу.
     */
    const after = await audio(page)
    expect(after.started - after.stopped).toBe(0)
  })

  test('у режимі клацання фону немає взагалі', async ({ page }) => {
    await setMode(page, 'clicks')
    await recordAudio(page)
    await page.goto('/games/odd-one-out')

    const before = await audio(page)
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.odd__item')
    const during = await audio(page)

    // Тільки клацання по кнопці, жодного фонового голосу.
    expect(during.started - before.started).toBeLessThanOrEqual(1)
  })

  test('у тиші не звучить нічого', async ({ page }) => {
    await setMode(page, 'off')
    await recordAudio(page)
    await page.goto('/games/odd-one-out')
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.odd__item')

    expect((await audio(page)).started).toBe(0)
  })
})
