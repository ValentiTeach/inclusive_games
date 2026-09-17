import { test, expect } from '@playwright/test'

/*
 * Дванадцять клавіш у ряд не вміщуються в телефон: на 320 px кожна мала
 * 24,17 px — впритул до обов'язкового мінімуму WCAG 2.5.8 і впритул до товщини
 * дитячого пальця. Ширшати нікуди, ширина екрана скінченна.
 *
 * Тому нижче 480 px ті самі тридцять дві літери в тому самому порядку лягають
 * у чотири ряди по вісім. Числа нижче стережуть відвойоване: кожен піксель тут
 * — це влучання замість промаху.
 */
const NARROW = [
  { width: 320, minKeyWidth: 37 },
  { width: 360, minKeyWidth: 42 },
  { width: 414, minKeyWidth: 48 },
  { width: 480, minKeyWidth: 57 },
]

/* Вище межі справжня розкладка лишається справжньою — її і вчать. */
const WIDE = [
  { width: 481, minKeyWidth: 37 },
  { width: 768, minKeyWidth: 43 },
]

async function openTrainer(page, width, height = 800) {
  await page.setViewportSize({ width, height })
  await page.goto('/games/keyboard-trainer')
  await page.getByRole('button', { name: 'Почати' }).click()
  await page.waitForSelector('.keyboard-trainer__key')
}

function layout(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.keyboard-trainer__row')]
    const boxes = [...document.querySelectorAll('.keyboard-trainer__key')].map((key) =>
      key.getBoundingClientRect(),
    )
    const board = document.querySelector('.keyboard-trainer__keyboard').getBoundingClientRect()
    return {
      perRow: rows.map((row) => row.querySelectorAll('.keyboard-trainer__key').length),
      letters: [...document.querySelectorAll('.keyboard-trainer__key')].map((key) =>
        key.textContent.trim(),
      ),
      narrowest: Math.min(...boxes.map((box) => box.width)),
      shortest: Math.min(...boxes.map((box) => box.height)),
      boardBottom: board.bottom,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
}

for (const { width, minKeyWidth } of NARROW) {
  test(`на ${width} px клавіатура має чотири ряди по вісім`, async ({ page }) => {
    await openTrainer(page, width)
    const m = await layout(page)

    expect(m.perRow).toEqual([8, 8, 8, 8])
    expect(m.narrowest).toBeGreaterThanOrEqual(minKeyWidth)
    expect(m.shortest).toBeGreaterThanOrEqual(52)
    expect(m.scrollWidth).toBe(width)
  })
}

for (const { width, minKeyWidth } of WIDE) {
  test(`на ${width} px лишається справжня розкладка`, async ({ page }) => {
    await openTrainer(page, width)
    const m = await layout(page)

    expect(m.perRow).toEqual([12, 11, 9])
    expect(m.narrowest).toBeGreaterThanOrEqual(minKeyWidth)
    expect(m.scrollWidth).toBe(width)
  })
}

/**
 * Перенесення не має ні губити літер, ні міняти їхній порядок: це та сама
 * розкладка, просто складена інакше.
 */
test('вузька розкладка — ті самі літери в тому самому порядку', async ({ page }) => {
  await openTrainer(page, 1280)
  const wide = (await layout(page)).letters

  await openTrainer(page, 360)
  const narrow = (await layout(page)).letters

  expect(narrow).toEqual(wide)
  expect(new Set(narrow).size).toBe(32)
})

/**
 * Чотири ряди вищі за три на 54 px. На найкоротшому поширеному екрані
 * клавіатура має лишитися видимою цілком, а не з'їхати під край.
 */
test('на короткому екрані клавіатура вміщується повністю', async ({ page }) => {
  await openTrainer(page, 320, 568)
  const m = await layout(page)

  expect(m.boardBottom).toBeLessThanOrEqual(568)
})

/**
 * Поворот телефона змінює ширину без перезавантаження: розкладка має
 * перебудуватися сама.
 */
test('поворот телефона перебудовує розкладку', async ({ page }) => {
  await openTrainer(page, 360, 740)
  expect((await layout(page)).perRow).toEqual([8, 8, 8, 8])

  await page.setViewportSize({ width: 740, height: 360 })
  await expect
    .poll(async () => (await layout(page)).perRow.length)
    .toBe(3)

  expect((await layout(page)).perRow).toEqual([12, 11, 9])
})
