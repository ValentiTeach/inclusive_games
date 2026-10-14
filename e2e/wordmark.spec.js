import { test, expect } from '@playwright/test'

/**
 * Напис марки — у кольорах самого знака: темно-синій корабля, чорний, білий і
 * відтінки синього. Кожна літера має свій тон, світлі літери — темний контур.
 *
 * Перевіряється те, що браузер справді обчислив для кожної літери: колір і
 * контур, — а не те, що написано в CSS.
 */
function parse(color) {
  return color.match(/[\d.]+/g).slice(0, 3).map(Number)
}

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

async function letters(page) {
  return page.evaluate(() => {
    const surface = getComputedStyle(document.querySelector('.site-header')).backgroundColor
    return {
      surface,
      letters: [...document.querySelectorAll('.site-header__logo-letter')].map((node) => {
        const style = getComputedStyle(node)
        // Контуром вважається лише справжня обвідка (зсув в обидва боки), а не
        // напівпрозора тінь «об'єму» під темними літерами.
        const outlined = style.textShadow.includes('-1px')
        const edge = outlined ? style.textShadow.match(/rgba?\([^)]+\)/)[0] : null
        return { char: node.textContent, color: style.color, edge }
      }),
    }
  })
}

for (const scheme of ['light', 'dark']) {
  const name = scheme === 'light' ? 'світлій' : 'темній'

  test.describe(`марка в ${name} темі`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/')
      await expect(page.locator('.site-header__logo-name')).toBeVisible()
    })

    test('усі літери на місці й читаються', async ({ page }) => {
      const { surface, letters: list } = await letters(page)
      expect(list.map((letter) => letter.char).join('')).toBe('InclusiveGames')

      /*
       * Літера читається, якщо від тла її відділяє або власний колір, або
       * контур. Біла літера на білій шапці тримається саме на контурі.
       */
      for (const letter of list) {
        const fill = contrast(parse(letter.color), parse(surface))
        const edge = letter.edge ? contrast(parse(letter.edge), parse(surface)) : 0
        expect(
          Math.max(fill, edge),
          `«${letter.char}» ${letter.color} (контур ${letter.edge}) на ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })

    test('напис різнокольоровий, і лише в кольорах марки', async ({ page }) => {
      const { letters: list } = await letters(page)
      const colors = new Set(list.map((letter) => letter.color))
      expect(colors.size).toBeGreaterThanOrEqual(3)

      /* Сині, білий, чорний — синій канал ніде не слабший за червоний і
         зелений. Кольори навичок (бірюзовий, фіолетовий, охра, малиновий)
         цю перевірку не пройшли б. */
      for (const color of colors) {
        const [r, g, b] = parse(color)
        expect(b, color).toBeGreaterThanOrEqual(Math.max(r, g))
      }
    })
  })
}

/**
 * Літери стоять окремими елементами, і читач екрана вимовив би назву по
 * буквах. Тому літери сховані від нього, а ціла назва звучить окремо.
 */
test('читач екрана чує цілу назву, а не літери', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^Inclusive Games/ })).toBeVisible()
  await expect(page.locator('.site-header__logo-letters')).toHaveAttribute('aria-hidden', 'true')
})

/** У режимі високої контрастності кольори призначає система, а не марка. */
test('у високій контрастності напис — звичайний текст без контуру', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/')
  await expect(page.locator('.site-header__logo-name')).toBeVisible()

  const shadows = await page
    .locator('.site-header__logo-letter')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).textShadow))
  expect(new Set(shadows)).toEqual(new Set(['none']))
})
