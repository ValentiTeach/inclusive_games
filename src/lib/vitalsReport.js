import { supabase } from './supabaseClient'

/**
 * Звіт швидкості для модератора: 75-й процентиль кожного показника окремо
 * для телефонів, планшетів і комп'ютерів.
 *
 * 75-й, а не середнє, — так рахує й Google: середнє ховає повільний хвіст,
 * а саме в ньому шкільний планшет на перевантаженому Wi-Fi.
 */

// Межі «добре / треба покращити» від web.dev; CLS — без одиниць.
export const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, unit: 'мс', label: 'Головний вміст з’явився' },
  INP: { good: 200, poor: 500, unit: 'мс', label: 'Відгук на натискання' },
  CLS: { good: 0.1, poor: 0.25, unit: '', label: 'Стрибки розмітки' },
  FCP: { good: 1800, poor: 3000, unit: 'мс', label: 'Перший малюнок' },
  TTFB: { good: 800, poor: 1800, unit: 'мс', label: 'Відповідь сервера' },
}

export const DEVICES = { phone: 'Телефон', tablet: 'Планшет', desktop: 'Комп’ютер' }

export function percentile(values, p = 0.75) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

export function ratingOf(name, value) {
  const limits = THRESHOLDS[name]
  if (!limits || value === null) return null
  if (value <= limits.good) return 'good'
  if (value <= limits.poor) return 'needs-improvement'
  return 'poor'
}

/** Рядки web_vitals → таблиця показник × пристрій і найповільніші сторінки. */
export function summarizeVitals(rows) {
  const table = {}
  for (const name of Object.keys(THRESHOLDS)) {
    table[name] = {}
    for (const device of Object.keys(DEVICES)) {
      const values = rows
        .filter((row) => row.name === name && row.device === device)
        .map((row) => row.value)
      const value = percentile(values)
      table[name][device] = { value, count: values.length, rating: ratingOf(name, value) }
    }
  }

  const byPath = new Map()
  for (const row of rows) {
    if (row.name !== 'LCP' || !row.path) continue
    byPath.set(row.path, [...(byPath.get(row.path) ?? []), row.value])
  }
  const slowPages = [...byPath.entries()]
    .filter(([, values]) => values.length >= 3)
    .map(([path, values]) => ({ path, value: percentile(values), count: values.length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return { table, slowPages, total: rows.length }
}

export async function fetchVitals({ days = 7, limit = 5000 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('web_vitals')
    .select('name, value, device, path')
    .gte('at', since)
    .order('at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
