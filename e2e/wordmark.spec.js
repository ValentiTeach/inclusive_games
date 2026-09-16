import { test, expect } from '@playwright/test'

/**
 * Марка написана градієнтом із чотирьох кольорів навичок. Градієнтний текст
 * легко стає гарним і нечитним, тому колір літер тут не береться з CSS — він
 * читається зі знімка, як його намалював браузер.
 *
 * Кольори категорій для цього не годилися: на білій поверхні шапки «Мислення»
 * давало 3.04:1, тобто трималося лише на тому, що напис великий і жирний.
 * Токени --brand-* — ті самі тони, затемнені до 5:1.
 */
function luminance([r, g, b]) {
  const channel = (value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/*
 * Пікселі самих літер, без згладжених країв. Проміжок між літерами — теж
 * колонка, і найдальший піксель у ній це блідий залишок згладжування: перша
 * спроба міряти його дала 1.26:1 — колір краю, а не напису. Тож у рахунок іде
 * лише те, що вкрите майже повністю.
 */
async function letterPixels(page) {
  const shot = await page.locator('.site-header__logo-name').screenshot()
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const surface = getComputedStyle(document.querySelector('.site-header')).backgroundColor
    const [sr, sg, sb] = surface.match(/\d+/g).map(Number)
    const away = (r, g, b) => (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2

    const columns = []
    let peak = 0
    for (let x = 0; x < canvas.width; x += 1) {
      let best = null
      let bestAway = 0
      for (let y = 0; y < canvas.height; y += 1) {
        const i = (y * canvas.width + x) * 4
        if (px[i + 3] < 250) continue
        const d = away(px[i], px[i + 1], px[i + 2])
        if (d > bestAway) {
          bestAway = d
          best = [px[i], px[i + 1], px[i + 2]]
        }
      }
      if (!best) continue
      columns.push({ pixel: best, away: bestAway })
      if (bestAway > peak) peak = bestAway
    }

    return {
      surface: [sr, sg, sb],
      pixels: columns.filter((column) => column.away >= peak * 0.95).map((c) => c.pixel),
      total: columns.length,
    }
  }, shot.toString('base64'))
}

for (const scheme of ['light', 'dark']) {
  test(`марка читається в ${scheme === 'light' ? 'світлій' : 'темній'} темі`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await expect(page.locator('.site-header__logo-name')).toBeVisible()

    const { surface, pixels } = await letterPixels(page)
    /*
     * Повністю вкритих колонок мало — на 19 px такими є лише найтовщі місця
     * штрихів, решта в тій чи іншій мірі змішана з тлом. Десятка вистачає, щоб
     * зачепити всі чотири кольори градієнта; менше означало б, що знімок не
     * той або напис зник.
     */
    expect(pixels.length).toBeGreaterThanOrEqual(8)

    const ratios = pixels.map((pixel) => contrast(pixel, surface))
    const worst = Math.min(...ratios)
    const worstPixel = pixels[ratios.indexOf(worst)]

    expect(
      worst,
      `найгірша літера rgb(${worstPixel}) на rgb(${surface}) — ${worst.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5)
  })
}

/**
 * Напис має бути різнокольоровим, а не просто пофарбованим в один колір із
 * палітри: саме однотонність і була вадою.
 */
test('у написі справді кілька кольорів', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.site-header__logo-name')).toBeVisible()

  const { pixels } = await letterPixels(page)
  const hues = new Set(pixels.map(([r, g, b]) => `${r >> 5}:${g >> 5}:${b >> 5}`))

  expect(hues.size).toBeGreaterThanOrEqual(3)
})

/**
 * background-clip: text робить колір прозорим. Якщо браузер цього не вміє, а
 * прозорість уже застосована, назва сайту зникає. Тому прозорість живе тільки
 * всередині @supports, а базове правило лишає звичайний колір.
 *
 * Перевіряється саме базове правило в таблиці стилів, а не те, що видно зараз:
 * у Chromium @supports виконується завжди, тож підмінити його на сторінці не
 * вийде — а перевірка «я сам задав колір, і колір є» нічого не варта.
 */
test('у браузері без обрізання тла напис лишається видимим', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.site-header__logo-name')).toBeVisible()

  /*
   * Відтворюємо саме той браузер, якого боїмося: таблиця стилів перезбирається
   * без жодного блоку @supports і підставляється замість оригінальної. Якщо
   * прозорість колись переїде з-під запобіжника назовні, назва сайту тут зникне.
   *
   * Чому не читанням правил: Vite вішає на <link> атрибут crossorigin, і
   * sheet.cssRules кидає SecurityError — обхід таблиць повертав порожньо.
   */
  const color = await page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')]
    const texts = await Promise.all(links.map((link) => fetch(link.href).then((r) => r.text())))

    const stripSupports = (css) => {
      let out = ''
      let i = 0
      while (i < css.length) {
        const at = css.indexOf('@supports', i)
        if (at === -1) {
          out += css.slice(i)
          break
        }
        out += css.slice(i, at)
        let depth = 0
        let j = css.indexOf('{', at)
        for (; j < css.length; j += 1) {
          if (css[j] === '{') depth += 1
          else if (css[j] === '}') {
            depth -= 1
            if (depth === 0) break
          }
        }
        i = j + 1
      }
      return out
    }

    for (const link of links) link.disabled = true
    const style = document.createElement('style')
    style.textContent = texts.map(stripSupports).join('\n')
    document.head.append(style)

    await new Promise((resolve) => requestAnimationFrame(resolve))
    return getComputedStyle(document.querySelector('.site-header__logo-name')).color
  })

  expect(color).not.toBe('rgba(0, 0, 0, 0)')
  expect(color).not.toBe('transparent')
})
