import { test, expect } from '@playwright/test'

/*
 * Дванадцять клавіш у ряд не можуть мати рекомендованих WCAG 2.5.5 сорока
 * чотирьох пікселів на телефоні: для цього потрібно 528 px ширини екрана.
 * Обов'язковий мінімум WCAG 2.5.8 — 24 px, і колись клавіші мали 24,58 px,
 * тобто перевищували його на пів пікселя. Ці числа стережуть відвойоване:
 * кожен піксель тут — це влучання дитини замість промаху.
 */
const EXPECTED = [
  { width: 320, minKeyWidth: 24 },
  { width: 360, minKeyWidth: 27 },
  { width: 414, minKeyWidth: 31 },
]

for (const { width, minKeyWidth } of EXPECTED) {
  test(`клавіші тренажера лишаються натискальними на ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    await page.goto('/games/keyboard-trainer')
    await page.getByRole('button', { name: 'Почати' }).click()
    await page.waitForSelector('.keyboard-trainer__key')

    const measured = await page.evaluate(() => {
      const keys = [...document.querySelectorAll('.keyboard-trainer__key')]
      const boxes = keys.map((key) => key.getBoundingClientRect())
      return {
        narrowest: Math.min(...boxes.map((box) => box.width)),
        shortest: Math.min(...boxes.map((box) => box.height)),
        scrollWidth: document.documentElement.scrollWidth,
      }
    })

    expect(measured.narrowest).toBeGreaterThanOrEqual(minKeyWidth)
    expect(measured.shortest).toBeGreaterThanOrEqual(52)

    /*
     * Клавіатура навмисно виходить за поля сторінки на всю ширину екрана, тож
     * тут найлегше випадково створити горизонтальну прокрутку — а вона зсуває
     * всю гру вбік просто від дотику.
     */
    expect(measured.scrollWidth).toBe(width)
  })
}
