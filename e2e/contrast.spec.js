import { test, expect } from '@playwright/test'

/**
 * Контраст тексту над декором — виміряний, а не припущений.
 *
 * Декоративний шар (фото, блоби, сітки) лежить під усім вмістом сторінки, а не
 * лише в полях: у `.app-content` немає власного тла. Через це звичайний абзац
 * опинявся на насиченому синьому й давав 2.11:1 у світлій темі — удвічі нижче
 * норми 4.5 для основного тексту.
 *
 * Тест читає справжні пікселі: колір тексту береться з обчисленого стилю, а тло
 * — зі знімка, де той самий текст зроблено прозорим. Кілька кадрів поспіль, бо
 * блоби рухаються і найгірша точка не завжди в першому кадрі.
 */
const PAGES = ['/', '/games', '/progress']
const MINIMUM = 4.5

function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** color-mix обчислюється в color(srgb 0.26 …) — канали 0..1, а не 0..255. */
function parseColor(value) {
  const numbers = value.match(/[\d.]+/g).slice(0, 3).map(Number)
  return value.startsWith('color(') ? numbers.map((n) => Math.round(n * 255)) : numbers
}

async function worstContrast(page, selector) {
  const element = page.locator(selector).first()
  const color = parseColor(await element.evaluate((node) => getComputedStyle(node).color))
  await page.addStyleTag({ content: `${selector}{color:transparent!important}` })

  let worst = { ratio: Infinity, pixel: null }
  for (const frame of [0, 1, 2]) {
    await page.waitForTimeout(frame ? 2400 : 200)
    const box = await element.boundingBox()
    const shot = (await page.screenshot()).toString('base64')
    const pixels = await page.evaluate(
      ([data, area]) =>
        new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0)
            const raw = ctx.getImageData(
              Math.round(area.x),
              Math.round(area.y),
              Math.round(area.width),
              Math.round(area.height),
            ).data
            const out = []
            for (let i = 0; i < raw.length; i += 4) out.push([raw[i], raw[i + 1], raw[i + 2]])
            resolve(out)
          }
          img.src = 'data:image/png;base64,' + data
        }),
      [shot, box],
    )

    for (const pixel of pixels) {
      const ratio = contrast(color, pixel)
      if (ratio < worst.ratio) worst = { ratio, pixel }
    }
  }
  return { color, ...worst }
}

for (const path of PAGES) {
  for (const scheme of ['light', 'dark']) {
    test(`${path} у ${scheme === 'light' ? 'світлій' : 'темній'} темі: текст читається над декором`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(path)
      await expect(page.locator('main p').first()).toBeVisible()

      const { ratio, pixel, color } = await worstContrast(page, 'main p')

      expect(
        ratio,
        `текст rgb(${color}) на найгіршому тлі rgb(${pixel}) — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MINIMUM)
    })
  }
}
