import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * Заголовки безпеки з vercel.json.
 *
 * CSP пропускає два вбудовані скрипти index.html (тема до першого кадру і
 * запобіжник порожнього екрана) не через 'unsafe-inline', а за хешем вмісту.
 * Зміна в будь-якому з них — навіть пробіл — міняє хеш, і браузер мовчки
 * перестає їх виконувати: біла спалахує темна тема, а запобіжник не
 * спрацьовує саме тоді, коли потрібен. Цей тест ловить розбіжність і каже,
 * який хеш покласти в vercel.json.
 */
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const html = readFileSync('index.html', 'utf8')

const everywhere = vercel.headers.find((rule) => rule.source === '/(.*)')
const header = (key) => everywhere.headers.find((entry) => entry.key === key)?.value

const csp = header('Content-Security-Policy')
const directive = (name) =>
  csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(/\s+/) ?? []

function inlineScripts() {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
  return [...html.matchAll(pattern)].map((match) => match[1])
}

describe('заголовки безпеки', () => {
  it('кожен вбудований скрипт index.html дозволено його хешем', () => {
    const scripts = inlineScripts()
    expect(scripts.length).toBeGreaterThan(0)

    for (const body of scripts) {
      const hash = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
      expect(directive('script-src'), `додай ${hash} у script-src у vercel.json`).toContain(hash)
    }
  })

  it('у script-src немає зайвих хешів — від скриптів, яких уже нема', () => {
    const hashes = directive('script-src').filter((source) => source.startsWith("'sha256-"))
    expect(hashes).toHaveLength(inlineScripts().length)
  })

  it('скрипти — лише свої: без unsafe-inline і eval', () => {
    const scripts = directive('script-src')
    expect(scripts).toContain("'self'")
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
  })

  it('дані йдуть лише до свого Supabase-проєкту', () => {
    const connect = directive('connect-src')
    expect(connect).toContain('https://uwostumcmuxmocexpnic.supabase.co')
    expect(connect.every((source) => source === "'self'" || source.includes('uwostumcmuxmocexpnic'))).toBe(
      true,
    )
  })

  it('сайт не можна вбудувати в чужу сторінку', () => {
    expect(directive('frame-ancestors')).toEqual(["'none'"])
    expect(header('X-Frame-Options')).toBe('DENY')
  })

  it('решта заголовків на місці', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/)
    expect(header('X-Content-Type-Options')).toBe('nosniff')
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(header('Permissions-Policy')).toContain('camera=()')
    expect(header('Permissions-Policy')).toContain('microphone=()')
  })

  /*
   * Файли в /assets мають хеш у назві: стара назва — завжди старий вміст, тож
   * їх можна кешувати назавжди. А sw.js — ні: інакше нова версія service
   * worker дісталася б пристроям лише через добу.
   */
  it('кеш: файли збірки — назавжди, service worker — завжди свіжий', () => {
    const cacheFor = (source) =>
      vercel.headers
        .find((rule) => rule.source === source)
        ?.headers.find((entry) => entry.key === 'Cache-Control')?.value

    expect(cacheFor('/assets/(.*)')).toContain('immutable')
    expect(cacheFor('/sw.js')).toBe('no-cache')
  })
})
