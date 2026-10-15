import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CATEGORIES, GAMES } from './games'
import {
  CATEGORY_ACCUSATIVE,
  isPrivatePath,
  pageMetaFor,
  publicPaths,
  renderHtmlMeta,
  robotsTxt,
  sitemapXml,
} from './seo'

const SITE = 'https://example.test'
const html = readFileSync('index.html', 'utf8')
const app = readFileSync('src/App.jsx', 'utf8')

describe('мета сторінок', () => {
  it('у кожної гри своя назва й опис, у правильному відмінку', () => {
    for (const game of GAMES) {
      const meta = pageMetaFor(`/games/${game.id}`)
      expect(meta.title, game.id).toContain(game.title)
      expect(meta.title, game.id).toContain(`гра на ${CATEGORY_ACCUSATIVE[game.category]}`)
      expect(meta.description, game.id).toBe(game.description)
      expect(meta.index).toBe(true)
    }
  })

  it('кожна категорія має форму для «гра на …»', () => {
    for (const key of Object.keys(CATEGORIES)) {
      expect(CATEGORY_ACCUSATIVE[key], key).toBeTruthy()
    }
  })

  /*
   * Нова сторінка в App.jsx без запису в seo.js отримала б назву «Сторінку не
   * знайдено» і noindex — тихо. Тест вимагає, щоб кожен маршрут був або
   * публічним із власною назвою, або явно особистим.
   */
  it('кожен маршрут застосунку має назву', () => {
    const routes = [...app.matchAll(/<Route path="([^"*]+)"/g)].map((match) => match[1])
    expect(routes.length).toBeGreaterThan(10)

    for (const route of routes) {
      const path = route.replaceAll(/:[^/]+/g, 'x').replace('/games/x', '/games/schulte')
      const meta = pageMetaFor(path)
      expect(meta.title, route).not.toMatch(/не знайдено/)
      expect(meta.index || isPrivatePath(path), route).toBe(true)
    }
  })

  it('особисті сторінки не індексуються', () => {
    for (const path of ['/groups/g1', '/admin', '/child', '/session/p1', '/join', '/account']) {
      expect(pageMetaFor(path).index, path).toBe(false)
    }
  })

  it('невідома адреса — noindex', () => {
    expect(pageMetaFor('/no-such-page').index).toBe(false)
    expect(pageMetaFor('/games/no-such-game').index).toBe(false)
  })
})

describe('файли для пошуковиків', () => {
  it('sitemap має головну, каталог, довідку й кожну гру — і жодної особистої сторінки', () => {
    const xml = sitemapXml(SITE, '2026-10-15')
    for (const path of ['/', '/games', '/help', '/privacy', '/accessibility']) {
      expect(xml).toContain(`<loc>${SITE}${path}</loc>`)
    }
    for (const game of GAMES) expect(xml).toContain(`<loc>${SITE}/games/${game.id}</loc>`)
    for (const path of publicPaths()) expect(isPrivatePath(path), path).toBe(false)
  })

  it('robots.txt закриває особисте й веде до sitemap', () => {
    const robots = robotsTxt(SITE)
    for (const path of ['/groups', '/admin', '/child', '/session', '/join']) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })
})

describe('HTML окремої сторінки', () => {
  const page = renderHtmlMeta(html, pageMetaFor('/games/stroop'), SITE)

  it('підставляє назву, опис, canonical і картку посилання', () => {
    expect(page).toContain('<title>Тест Струпа — гра на увагу — Inclusive Games</title>')
    expect(page).toMatch(/property="og:title"\s+content="Тест Струпа — гра на увагу/)
    expect(page).toMatch(new RegExp(`rel="canonical"\\s+href="${SITE}/games/stroop"`))
    expect(page).toMatch(new RegExp(`property="og:image"\\s+content="${SITE}/og-image.png"`))
    expect(page).toMatch(/name="twitter:card"\s+content="summary_large_image"/)
  })

  // Скрипти мають лишитися байт у байт: CSP пускає їх за хешем.
  it('вбудованих скриптів не чіпає', () => {
    const scripts = (text) => [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(scripts(page)).toEqual(scripts(html))
  })

  it('екранує лапки й кутові дужки', () => {
    const tricky = renderHtmlMeta(html, { title: 'A "B" <C>', description: 'x & y', path: '/x' }, SITE)
    expect(tricky).toContain('<title>A &quot;B&quot; &lt;C&gt;</title>')
    expect(tricky).toMatch(/name="description"\s+content="x &amp; y"/)
  })

  it('без потрібного тегу в index.html збірка падає, а не мовчить', () => {
    expect(() => renderHtmlMeta('<html></html>', pageMetaFor('/'), SITE)).toThrow(/не знайдено/)
  })
})
