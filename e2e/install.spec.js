import { test, expect } from '@playwright/test'

/**
 * Маніфест перевіряється не в коді, а поданим: файл лежить у public і їде в
 * збірку як є, тож помилка в шляху видна лише тоді, коли його справді
 * запитали.
 */
test('маніфест подається, і все, на що він посилається, теж', async ({ page, request }) => {
  await page.goto('/')

  const href = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  expect(href).toBeTruthy()

  const response = await request.get(href)
  expect(response.status()).toBe(200)

  const manifest = await response.json()
  const files = [
    ...manifest.icons.map((icon) => ({ src: icon.src, type: icon.type })),
    ...manifest.screenshots.map((shot) => ({ src: shot.src, type: shot.type })),
  ]

  for (const file of files) {
    const response = await request.get(file.src)
    expect(response.status(), file.src).toBe(200)

    /*
     * Саме тип, а не код відповіді: на невідомий шлях сервер односторінкового
     * застосунку віддає index.html із тим самим 200. Перевірка «сторінка
     * відповіла» проходила б і для знімка, якого немає, — на цьому вона й
     * попалася вперше.
     */
    expect(response.headers()['content-type'], file.src).toContain(file.type)
  }
})

/**
 * Маска зрізає з іконки приблизно десяту частину з кожного боку — усе, що
 * далі ніж 40% розміру від центру. Стара маскована іконка сягала 245 px при
 * межі 205: краї хвиль зникали, і помітити це можна було лише на телефоні.
 *
 * Тому межа міряється з пікселів, а не з наміру.
 */
test('маскована іконка вміщується в безпечне коло', async ({ page, request }) => {
  await page.goto('/')

  const manifest = await (await request.get('/manifest.webmanifest')).json()
  const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable')
  expect(maskable).toBeTruthy()

  const bytes = await (await request.get(maskable.src)).body()
  const base64 = bytes.toString('base64')

  const measured = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Колір тла — з кутового пікселя: маскована іконка мусить мати суцільне тло.
    const bg = [px[0], px[1], px[2]]
    const isInk = (i) =>
      px[i + 3] > 200 &&
      Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 40

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    let reach = 0
    let transparentCorners = 0

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4
        if (px[i + 3] < 200) transparentCorners += 1
        if (!isInk(i)) continue
        reach = Math.max(reach, Math.hypot(x - cx, y - cy))
      }
    }

    return { size: canvas.width, reach, safe: canvas.width * 0.4, transparentCorners }
  }, base64)

  expect(
    measured.reach,
    `знак сягає ${measured.reach.toFixed(0)} px від центру при межі ${measured.safe.toFixed(0)}`,
  ).toBeLessThanOrEqual(measured.safe)

  // Прозорі кути під маскою стають чорними або білими — залежно від телефона.
  expect(measured.transparentCorners).toBe(0)
})
