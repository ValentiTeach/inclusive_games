import { test, expect } from '@playwright/test'

// These run against the built app with no Supabase credentials, so they cover
// exactly the parts a visitor sees before signing in — which is also the part
// that has to render identically across browsers.

test('home page renders its hero and lets you reach the catalogue', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByRole('link', { name: 'Переглянути каталог ігор' }).click()
  await expect(page).toHaveURL(/\/games/)
})

test('catalogue lists every game and opens a free one', async ({ page }) => {
  await page.goto('/games')

  await expect(page.locator('.game-card')).toHaveCount(12)

  const playable = page.locator('a.game-card[href^="/games/"]')
  await expect(playable.first()).toBeVisible()

  await playable.first().click()
  await expect(page).toHaveURL(/\/games\/.+/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// Guest gating is business logic, not decoration: a signed-out visitor can play
// the three sample games, and every other card sends them to sign in instead of
// opening the game.
test('locked games send a signed-out visitor to the login page', async ({ page }) => {
  await page.goto('/games')

  await expect(page.locator('a.game-card[href^="/games/"]')).toHaveCount(3)

  const locked = page.locator('a.game-card--locked')
  await expect(locked).toHaveCount(9)
  await expect(page.getByText('Потрібен вхід')).toHaveCount(9)

  await locked.first().click()
  await expect(page).toHaveURL(/\/login/)
})

test('login page offers both the student and the teacher route', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByText('Я учень')).toBeVisible()
  await expect(page.getByText('Я вчитель / психолог')).toBeVisible()
})

test('unknown routes land on the not-found page rather than a blank screen', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('Сторінку не знайдено')).toBeVisible()
})

// Guards the layout invariant behind an earlier bug: .app-shell and
// .app-content each need a real minimum height, or the footer rides up and the
// decorative layer stops covering the viewport. A browser that ignores the svh
// unit must still get a height from the vh fallback.
test('app shell fills the viewport height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  for (const selector of ['.app-shell', '.app-content']) {
    const height = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().height)
    expect(height, `${selector} should fill the viewport`).toBeGreaterThanOrEqual(880)
  }
})

// The viewport-height test above can't catch a missing fallback: it runs in a
// browser that understands svh, so the page looks right either way. This one
// inspects the shipped stylesheet instead — the minifier once dropped the vh
// fallback as a "duplicate min-height", and only the built artifact shows it.
test('shipped stylesheet keeps a viewport-height fallback for old browsers', async ({
  page,
  request,
}) => {
  await page.goto('/')

  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href')
  expect(href).toBeTruthy()

  const css = await (await request.get(href)).text()

  expect(css, 'plain vh fallback must survive minification').toMatch(
    /\.app-shell\{[^}]*min-height:100vh/,
  )
  expect(css, 'svh upgrade must stay behind @supports').toMatch(
    /@supports\s*\(height:\s*100svh\)/,
  )
})

// The unit tests assert the data-theme attribute, which would still pass if the
// CSS selector behind it were misspelled. These check the colour actually
// painted, so the whole chain — click, attribute, tokens, paint — is covered.
test.describe('theme switch', () => {
  const bodyBackground = (page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  test('follows a dark system by default and can be overridden both ways', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/settings')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const systemDark = await bodyBackground(page)

    await page.getByRole('button', { name: 'Світла', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const forcedLight = await bodyBackground(page)
    expect(forcedLight).not.toBe(systemDark)

    await page.getByRole('button', { name: 'Темна', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await bodyBackground(page)).toBe(systemDark)
  })

  test('the header button flips the theme from any page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const before = await bodyBackground(page)
    await page.getByRole('button', { name: 'Увімкнути світлу тему' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bodyBackground(page)).not.toBe(before)

    // The icon swaps to offer the opposite direction.
    await expect(page.getByRole('button', { name: 'Увімкнути темну тему' })).toBeVisible()
  })

  test('keeps the chosen theme across a reload, with no light flash on the way', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Темна', exact: true }).click()

    await page.reload()

    // Set by the inline script in index.html, before the bundle even parses.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

// Both of these were reported as "the site looks broken" and neither showed up
// at the 1280px the other tests use — they only appear on a wide screen with a
// signed-in teacher's long email in the header.
test.describe('wide screens', () => {
  test('header stays on one row instead of dropping the nav below the logo', async ({ page }) => {
    await page.setViewportSize({ width: 1830, height: 1000 })
    await page.goto('/')

    // Stand in for a signed-in teacher: the email is what overflows the row.
    await page.evaluate(() => {
      const label = document.querySelector('.site-header__account-label')
      if (label) label.textContent = 'andrysiak.valentin@gmail.com'
    })

    const height = await page
      .locator('.site-header__inner')
      .evaluate((el) => el.getBoundingClientRect().height)
    expect(height, 'a wrapped header is roughly double height').toBeLessThan(90)
  })

  test('no horizontal scrollbar at any common width', async ({ page }) => {
    for (const width of [1830, 1440, 1280, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(overflows, `page scrolls sideways at ${width}px`).toBe(false)
    }
  })

  // The blur is what turns these into soft colour; with it applied only in the
  // dark override the light theme showed hard-edged discs.
  test('background blobs stay blurred in the light theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize({ width: 1830, height: 1000 })
    await page.goto('/')

    const filter = await page
      .locator('.decor__blob')
      .first()
      .evaluate((el) => getComputedStyle(el).filter)

    expect(filter).toContain('blur')
  })

  // The photo is a fixed-width rectangle pinned top-right, so without a mask it
  // ends in hard straight edges partway across a wide page — invisible on the
  // light ground, a stuck-on patch on the dark one.
  test('background photo fades out instead of ending in a hard edge', async ({ page }) => {
    await page.setViewportSize({ width: 1830, height: 1000 })
    await page.goto('/')

    const mask = await page
      .locator('.decor__photo')
      .evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)

    expect(mask).toContain('radial-gradient')
  })
})

// The icons used to jump straight to their full offset the moment the cursor
// entered their radius, which read as darting away rather than drifting.
//
// Measured as the largest single-frame change relative to the total distance
// travelled: eased motion covers a fraction of the gap per frame, a snap covers
// all of it in one. Comparing "just after" against "settled" instead would not
// work — the icons also drift on their own, which moves those numbers around
// for reasons that have nothing to do with easing.
test('background icons glide away from the cursor rather than jumping', async ({ page }) => {
  await page.setViewportSize({ width: 1830, height: 1000 })
  await page.goto('/')

  const { maxStep, maxOffset } = await page.evaluate(async () => {
    // The offset is written to the icon itself, not to its positioning wrapper.
    const el = document.querySelector('.decor__icon')
    const read = () => {
      const t = getComputedStyle(el).translate
      if (!t || t === 'none') return 0
      const [x = 0, y = 0] = t.split(' ').map(parseFloat)
      return Math.hypot(x, y || 0)
    }

    const samples = [read()]

    // The move is dispatched from inside the sampling loop on purpose: driving
    // it from the test runner would let the animation frame that reacts to it
    // run before sampling starts, hiding the very jump this is looking for.
    const rect = el.getBoundingClientRect()
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2 + 30,
        clientY: rect.top + rect.height / 2,
      }),
    )

    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame)
      samples.push(read())
    }

    let maxStep = 0
    for (let i = 1; i < samples.length; i++) {
      maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]))
    }
    return { maxStep, maxOffset: Math.max(...samples) }
  })

  expect(maxOffset, 'the icon should be pushed away at all').toBeGreaterThan(3)
  expect(
    maxStep,
    'no single frame should cover most of the distance — that is a jump, not a glide',
  ).toBeLessThan(maxOffset * 0.5)
})

test('page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflows).toBe(false)
})

// Сторінка входу за кодом тепер рендерить форму лише після асинхронної
// перевірки, хто вже на пристрої. У справжньому браузері й на зібраному коді
// це має завершитися формою, а не залишити дитину перед «Перевіряємо…».
// (Поведінку при відмові сервера перевіряє Join.test.jsx — тут getSession
// читає localStorage і до мережі не доходить.)
test('join page resolves its identity check and shows the form', async ({ page }) => {
  await page.goto('/join')

  await expect(page.getByLabel('Код групи')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Твоє ім’я')).toBeVisible()
})

/**
 * Проходження гри від початку до результату **лише з клавіатури**, у справжньому
 * браузері: дитина має дійти до кінця, жодного разу не взявши мишу.
 *
 * Фокус навмисно ставиться на саму ігрову кнопку — це найгірший випадок для
 * Пробілу. Перевірено мутацією: цей шлях лишається чистим і без preventDefault,
 * бо answeredRef у грі вже робить відповідь ідемпотентною; два захисти
 * перекриваються. Контракт самого preventDefault закріплений юнітом
 * «cancels the key so a focused button cannot fire a second time» — там мутація
 * падає. Тут перевіряється інше й не менш важливе: одне натискання дитини не
 * перетворюється на фальстарт, і гра доходить до результату.
 *
 * «Час реакції» — єдина гра цього етапу, доступна гостю (schulte і memory-pairs
 * теж доступні, але їхня клавіатура — наступний крок).
 */
test('a whole game can be played to the results screen with the keyboard alone', async ({
  page,
}) => {
  await page.goto('/games/reaction-time')

  // До кнопки старту доходимо теж клавіатурою — інтро частина того самого шляху.
  const start = page.getByRole('button', { name: 'Почати' })
  await expect(start).toBeVisible()
  await start.focus()
  await page.keyboard.press('Enter')

  // Зворотний відлік: 3 кроки по 700 мс.
  await expect(page.getByText('Раунд 1 / 5')).toBeVisible({ timeout: 10_000 })

  // Фокус ставимо саме на ігрову кнопку: це той випадок, коли Пробіл міг би дати
  // і рідний клік, і обробник гри — дві відповіді на один сигнал.
  await page.getByRole('button', { name: /Чекай…|Тисни!/ }).focus()

  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`Раунд ${round} / 5`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Тисни!' })).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Space')
    await expect(page.getByText('Зарано! Спробуй ще раз')).toHaveCount(0)
  }

  await expect(page.getByRole('heading', { name: 'Результат' })).toBeVisible({ timeout: 10_000 })
})

// Підказка має бути там, де дитина її прочитає, — і до старту, і під час гри.
test('the key hint is shown before the game starts and while playing', async ({ page }) => {
  await page.goto('/games/reaction-time')

  await expect(page.getByText('зреагувати на сигнал')).toBeVisible()

  await page.getByRole('button', { name: 'Почати' }).click()
  await expect(page.getByText('Раунд 1 / 5')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('зреагувати на сигнал')).toBeVisible()
})

/**
 * Уся таблиця Шульте, пройдена самими цифрами у справжньому браузері.
 *
 * Це найсильніший доказ для цієї гри: 16 клітинок від початку до екрана
 * результатів, жодного кліку. Заразом видно, що набір двоцифрових чисел
 * (10–16) розв'язується сам, без Enter.
 */
test('a whole Schulte grid can be typed out with the keyboard', async ({ page }) => {
  await page.goto('/games/schulte')

  const start = page.getByRole('button', { name: 'Почати' })
  await start.focus()
  await page.keyboard.press('Enter')

  // Зворотний відлік: 3 кроки по 700 мс.
  await expect(page.locator('.schulte__grid')).toBeVisible({ timeout: 10_000 })

  for (let n = 1; n <= 16; n++) {
    for (const digit of String(n)) {
      await page.keyboard.press(digit)
    }
  }

  await expect(page.getByRole('heading', { name: 'Результат' })).toBeVisible({ timeout: 10_000 })
})

// Стрілки мають рухати курсор по сітці, а Enter — перевертати саме ту картку,
// на якій курсор стоїть.
test('memory pairs can be navigated and flipped with arrows and Enter', async ({ page }) => {
  await page.goto('/games/memory-pairs')

  await page.getByRole('button', { name: 'Почати' }).click()
  await expect(page.locator('.memory-pairs__grid')).toBeVisible({ timeout: 10_000 })

  const cards = page.locator('.memory-pairs__card')
  await expect(cards.first()).toHaveAttribute('tabindex', '0')

  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(1)).toHaveAttribute('tabindex', '0')
  await expect(cards.first()).toHaveAttribute('tabindex', '-1')

  await page.keyboard.press('Enter')
  await expect(cards.nth(1)).toHaveClass(/is-flipped/)

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Ходи: 1')).toBeVisible()
})

/**
 * Марка — темно-синій корабель на прозорому тлі, а поверхня шапки в темній темі
 * сама темно-синя. Знак на ній майже зникав. Виправлення навмисно не чіпає
 * кольорів марки — тому тест перевіряє і те, і те: підкладка світла в обох
 * темах, а на саме зображення не накладено жодного фільтра.
 */
test.describe('логотип', () => {
  async function markStyles(page, theme) {
    await page.addInitScript((value) => {
      localStorage.setItem('inclusive-games:settings', JSON.stringify({ theme: value }))
    }, theme)
    await page.goto('/')

    return page.locator('.site-header__logo-mark').evaluate((node) => {
      const style = getComputedStyle(node)
      const [r, g, b] = style.backgroundColor.match(/\d+/g).map(Number)
      return {
        luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
        filter: style.filter,
      }
    })
  }

  for (const theme of ['light', 'dark']) {
    test(`stays on a light plate in the ${theme} theme`, async ({ page }) => {
      const { luminance } = await markStyles(page, theme)

      expect(luminance).toBeGreaterThan(0.9)
    })

    test(`keeps its own colours in the ${theme} theme`, async ({ page }) => {
      const { filter } = await markStyles(page, theme)

      // Ані інверсії, ані перефарбування: кольори знака лишаються оригінальними.
      expect(filter).toBe('none')
    })
  }
})

/**
 * Адаптація до телефона й планшета.
 *
 * До цих правил шапка на екрані 360 px займала 230 px — третину висоти до
 * першого слова контенту, — а сторінка налаштувань давала горизонтальний скрол
 * у 48 px. Перевіряються саме ці числа, а не наявність медіазапитів.
 */
test.describe('малі екрани', () => {
  const PHONES = [
    ['телефон 360', 360, 740],
    ['телефон 390', 390, 844],
    ['телефон лежачи', 740, 360],
    ['планшет', 768, 1024],
  ]

  for (const [name, width, height] of PHONES) {
    test(`${name}: жодна сторінка не їде вбік`, async ({ page }) => {
      await page.setViewportSize({ width, height })

      for (const path of ['/', '/games', '/progress', '/settings', '/login', '/join']) {
        await page.goto(path)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${path} на ${name}`).toBe(0)
      }
    })

    test(`${name}: шапка не з'їдає екран`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/')

      const headerHeight = await page
        .locator('.site-header')
        .evaluate((node) => node.getBoundingClientRect().height)

      // Було 230. Один ряд з іконками плюс логотип — близько 100.
      expect(headerHeight).toBeLessThan(110)
    })
  }

  /**
   * Підписи ховаються візуально, а не через display: none — інакше посилання
   * лишилося б безіменною іконкою для того, хто слухає сторінку.
   */
  test('іконки навігації не втрачають своїх назв', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')

    const header = page.locator('.site-header')

    for (const label of ['Головна', 'Каталог ігор', 'Мій прогрес', 'Налаштування']) {
      // exact і пошук усередині шапки: «Каталог ігор» інакше збігається ще й
      // з кнопкою «Переглянути каталог ігор» у герої.
      await expect(header.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
  })

  // Група з трьох кнопок теми не влазила поруч із текстом і виїжджала за екран.
  test('налаштування показують усі варіанти теми', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/settings')

    for (const label of ['Системна', 'Світла', 'Темна']) {
      const button = page.getByRole('button', { name: label, exact: true })
      await expect(button).toBeVisible()

      const box = await button.boundingBox()
      expect(box.x + box.width, `«${label}» має бути в межах екрана`).toBeLessThanOrEqual(360)
      expect(box.height, `«${label}» — ціль для пальця`).toBeGreaterThanOrEqual(44)
    }
  })

  /**
   * На вузькому екрані текстова колонка займає всю ширину, тож декоративним
   * іконкам нема де бути, крім як під словами — вони лягали на абзаци.
   */
  test('декоративні іконки прибрані з-під тексту', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')

    await expect(page.locator('.decor__icon-wrap').first()).toBeHidden()
  })

  test('на десктопі декор і підписи лишаються на місці', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')

    await expect(page.locator('.decor__icon-wrap').first()).toBeVisible()
    await expect(page.locator('.site-header__link-label').first()).toBeVisible()
  })
})
