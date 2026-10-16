import { BUILD } from './build'

/**
 * Швидкість сайту в реальних браузерах — Web Vitals.
 *
 * Скільки секунд дитина на шкільному планшеті дивиться на порожній екран, з
 * комп'ютера розробника не видно. Тут міряє сам браузер (бібліотека
 * web-vitals від Chrome), а показники йдуть у таблицю web_vitals
 * (20261015_notifications_vitals.sql), де їх бачить модератор.
 *
 * Що НЕ йде: хто це був. Лише назва показника, значення, адреса сторінки без
 * id, тип пристрою, тип мережі й версія сайту.
 */

const ENDPOINT = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/web_vitals`
  : null
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/*
 * id у шляху (групи, учня, заняття) робили б кожну адресу унікальною — і
 * показники не складалися б докупи, і в таблицю лягали б ідентифікатори
 * дітей. /groups/7f3…/students/a1… → /groups/:id/students/:id.
 */
export function sanitizePath(pathname) {
  return pathname
    .split('/')
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(part) || /\d{3,}/.test(part) || part.length > 32 ? ':id' : part,
    )
    .join('/')
    .slice(0, 200)
}

export function deviceKind(width, coarse) {
  if (width < 600) return 'phone'
  if (width < 1024 || coarse) return 'tablet'
  return 'desktop'
}

function currentDevice() {
  try {
    return deviceKind(window.innerWidth, window.matchMedia('(pointer: coarse)').matches)
  } catch {
    return null
  }
}

export function toRow(metric, { path, device, effectiveType }) {
  return {
    name: metric.name,
    // CLS — частки, решта — мілісекунди; цілі мілісекунди досить, а CLS
    // з трьома знаками.
    value: metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value),
    rating: metric.rating ?? null,
    path,
    device,
    effective_type: effectiveType ?? null,
    build: BUILD,
  }
}

const queue = []

function flush() {
  if (!ENDPOINT || !ANON_KEY || queue.length === 0) return
  const rows = queue.splice(0)
  try {
    // keepalive: показники приходять саме тоді, коли вкладку ховають чи
    // закривають, і звичайний запит браузер на цьому обірвав би.
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    }).catch(() => {})
  } catch {
    // Вимірювання — не привід ламати сторінку.
  }
}

export function watchWebVitals() {
  if (!import.meta.env.PROD || !ENDPOINT || !ANON_KEY) return

  // Окремим шматком і на простої: вимірювання не має відбирати жодної
  // мілісекунди в самого завантаження, яке воно міряє.
  const start = () =>
    import('web-vitals')
      .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        const report = (metric) => {
          queue.push(
            toRow(metric, {
              path: sanitizePath(window.location.pathname),
              device: currentDevice(),
              effectiveType: navigator.connection?.effectiveType,
            }),
          )
        }
        for (const subscribe of [onCLS, onFCP, onINP, onLCP, onTTFB]) subscribe(report)
      })
      .catch(() => {})

  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 2000)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}
