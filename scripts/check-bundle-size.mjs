/**
 * Бюджет розміру збірки. Запускати після `npm run build`: `npm run size`.
 *
 * Нова гра чи бібліотека непомітно роздуває те, що вантажиться до першого
 * кадру, — а саме це дитина чекає на шкільному планшеті через повільний
 * Wi-Fi. Перевищення бюджету валить CI, і рішення «так, це варте того»
 * доводиться ухвалювати явно, змінивши число тут.
 *
 * Міряється gzip — те, що реально їде мережею.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const KB = 1024

const BUDGETS = {
  // Усе, що index.html вантажить одразу: точка входу й modulepreload-шматки.
  initialJs: 125 * KB,
  // Найбільший шматок, що вантажиться пізніше (сторінка, гра).
  lazyChunk: 45 * KB,
  // Усі стилі разом.
  css: 60 * KB,
}

const dir = new URL('../dist/', import.meta.url)
const html = readFileSync(new URL('index.html', dir), 'utf8')
const assets = readdirSync(new URL('assets/', dir))

const gz = (file) => gzipSync(readFileSync(new URL(`assets/${file}`, dir))).length
const fmt = (bytes) => `${(bytes / KB).toFixed(1)} KB`

const initial = new Set([...html.matchAll(/assets\/([^"]+\.js)/g)].map((match) => match[1]))
const js = assets.filter((file) => file.endsWith('.js'))

const initialJs = [...initial].reduce((sum, file) => sum + gz(file), 0)
const lazy = js
  .filter((file) => !initial.has(file))
  .map((file) => ({ file, size: gz(file) }))
  .sort((a, b) => b.size - a.size)
const css = assets.filter((file) => file.endsWith('.css')).reduce((sum, file) => sum + gz(file), 0)

const checks = [
  ['Початкове завантаження JS', initialJs, BUDGETS.initialJs],
  [`Найбільший пізній шматок (${lazy[0]?.file ?? '—'})`, lazy[0]?.size ?? 0, BUDGETS.lazyChunk],
  ['Стилі', css, BUDGETS.css],
]

let failed = false
for (const [label, size, budget] of checks) {
  const over = size > budget
  failed ||= over
  console.log(`${over ? '✗' : '✓'} ${label}: ${fmt(size)} з ${fmt(budget)}`)
}

if (failed) {
  console.error(
    '\nБюджет перевищено. Якщо збільшення виправдане — змініть BUDGETS у scripts/check-bundle-size.mjs і поясніть у коміті чому.',
  )
  process.exit(1)
}
