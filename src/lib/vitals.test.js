import { describe, it, expect } from 'vitest'
import { deviceKind, sanitizePath, toRow } from './vitals'
import { percentile, ratingOf, summarizeVitals } from './vitalsReport'

describe('Web Vitals: що йде на сервер', () => {
  // id дітей і груп у таблицю швидкості потрапляти не мають.
  it('прибирає з адреси ідентифікатори', () => {
    expect(
      sanitizePath('/groups/7f3c2a10-1111-4222-8333-444455556666/students/a1b2c3d4-0000-4000-8000-000000000000'),
    ).toBe('/groups/:id/students/:id')
    expect(sanitizePath('/session/1234567')).toBe('/session/:id')
    expect(sanitizePath('/games/schulte')).toBe('/games/schulte')
    expect(sanitizePath('/')).toBe('/')
  })

  it('розрізняє телефон, планшет і комп’ютер', () => {
    expect(deviceKind(390, true)).toBe('phone')
    expect(deviceKind(820, true)).toBe('tablet')
    expect(deviceKind(1280, true)).toBe('tablet')
    expect(deviceKind(1280, false)).toBe('desktop')
  })

  it('округлює й нічого не додає про людину', () => {
    const row = toRow({ name: 'CLS', value: 0.123456, rating: 'needs-improvement' }, { path: '/', device: 'phone' })
    expect(row).toEqual({
      name: 'CLS',
      value: 0.123,
      rating: 'needs-improvement',
      path: '/',
      device: 'phone',
      effective_type: null,
      build: expect.any(String),
    })
    expect(toRow({ name: 'LCP', value: 2345.6 }, { path: '/', device: 'desktop' }).value).toBe(2346)
  })
})

describe('звіт швидкості', () => {
  it('75-й процентиль', () => {
    expect(percentile([1, 2, 3, 4])).toBe(3)
    expect(percentile([10])).toBe(10)
    expect(percentile([])).toBeNull()
  })

  it('оцінює за межами web.dev', () => {
    expect(ratingOf('LCP', 2400)).toBe('good')
    expect(ratingOf('LCP', 3000)).toBe('needs-improvement')
    expect(ratingOf('LCP', 5000)).toBe('poor')
    expect(ratingOf('CLS', 0.05)).toBe('good')
  })

  it('зводить по пристроях і знаходить найповільніші сторінки', () => {
    const rows = [
      ...[1000, 2000, 3000, 4000].map((value) => ({ name: 'LCP', value, device: 'phone', path: '/games' })),
      ...[500, 600, 700].map((value) => ({ name: 'LCP', value, device: 'desktop', path: '/' })),
    ]
    const report = summarizeVitals(rows)
    expect(report.table.LCP.phone).toEqual({ value: 3000, count: 4, rating: 'needs-improvement' })
    expect(report.table.LCP.tablet.value).toBeNull()
    expect(report.slowPages[0]).toEqual({ path: '/games', value: 3000, count: 4 })
  })
})
