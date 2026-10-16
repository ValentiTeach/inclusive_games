/**
 * Картинка для карток посилань (public/og-image.png, 1200×630).
 *
 * Не потрібна для збірки — лише щоб перемалювати картинку, коли зміниться
 * знак чи гасло: `node scripts/og-image.mjs`. Малює звичайну HTML-сторінку в
 * Chromium від Playwright, тож текст можна правити як текст, а не в
 * графічному редакторі. Шлях до браузера — як у playwright.config.js
 * (PW_CHROMIUM_PATH).
 */
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const logo = readFileSync(new URL('../public/logo.png', import.meta.url)).toString('base64')

const SKILLS = [
  ['Увага', '#2f8fae'],
  ['Пам’ять', '#7c5cd9'],
  ['Мислення', '#c8862b'],
  ['Реакція', '#d24b64'],
  ['Слух і мовлення', '#277f50'],
  ['Простір і рух', '#5a6a10'],
  ['Саморегуляція', '#4553b8'],
]

const html = `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #10203a;
    background:
      radial-gradient(circle at 92% 8%, rgba(11,77,163,.20), transparent 42%),
      radial-gradient(circle at 8% 100%, rgba(124,92,217,.16), transparent 40%),
      #f7f9fc;
    display: flex; align-items: center; padding: 0 84px; gap: 64px;
  }
  .logo { width: 300px; height: auto; flex: none; filter: drop-shadow(0 12px 28px rgba(16,32,58,.18)); }
  h1 { font-size: 76px; line-height: 1.02; letter-spacing: -1.5px; color: #0b4da3; }
  p { margin-top: 18px; font-size: 34px; line-height: 1.25; font-weight: 600; }
  ul { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; padding: 0; list-style: none; }
  li { padding: 8px 16px; font-size: 21px; font-weight: 700; border-radius: 999px; background: #fff; border: 2px solid currentColor; }
  .note { margin-top: 26px; font-size: 22px; font-weight: 500; color: #36425a; }
</style></head><body>
  <img class="logo" src="data:image/png;base64,${logo}" alt="">
  <div>
    <h1>Inclusive Games</h1>
    <p>Ігри, що тренують увагу, пам’ять і мислення</p>
    <ul>${SKILLS.map(([label, color]) => `<li style="color:${color}">${label}</li>`).join('')}</ul>
    <div class="note">Для уроку, заняття з фахівцем і дому · з адаптаціями</div>
  </div>
</body></html>`

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
)
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: new URL('../public/og-image.png', import.meta.url).pathname })
await browser.close()
console.log('public/og-image.png')
