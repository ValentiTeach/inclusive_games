import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signInAsTeacher } from './support/teacher.js'

/*
 * Автоматична перевірка доступності (axe-core) на ключових сторінках, у
 * світлій і темній темі. Ловить те, що легко зламати непомітно: безіменну
 * кнопку, поле без підпису, контраст нового кольору, дубль id.
 *
 * Межа — WCAG 2.1 A/AA, і падає тест лише на «серйозних» і «критичних»
 * порушеннях: решту axe показує як поради, а не як помилки. Автоматика
 * знаходить приблизно третину проблем — тож це запобіжник, а не аудит.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function scan(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Декоративний фон — під усім вмістом і aria-hidden; контраст тексту над
    // ним міряє окремий тест за справжніми пікселями (contrast.spec.js), а
    // axe на розмитому зображенні дає хибні спрацювання.
    .exclude('.decor')
    .analyze()
  return violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
}

const PUBLIC = ['/', '/games', '/games/schulte', '/help', '/accessibility', '/privacy', '/feedback', '/settings', '/login', '/join', '/progress', '/print/cards']

for (const scheme of ['light', 'dark']) {
  test(`публічні сторінки без серйозних порушень (${scheme === 'light' ? 'світла' : 'темна'} тема)`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    const found = {}
    for (const path of PUBLIC) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const violations = await scan(page)
      if (violations.length) found[path] = violations
    }
    expect(found).toEqual({})
  })
}

test('сторінки вчителя без серйозних порушень', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const group = { id: 'g1', name: '3-Б', join_code: 'ABC234', created_at: '2026-09-01T00:00:00Z' }
  await signInAsTeacher(page, {
    groups: [group],
    students: [{ id: 's1', display_name: 'Оля', created_at: '2026-09-02T00:00:00Z' }],
    results: [],
    profile: { display_name: 'Вчителька', group_id: null, role: 'moderator' },
  })
  const found = {}
  for (const path of ['/groups', '/groups/g1', '/account', '/admin']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const violations = await scan(page)
    if (violations.length) found[path] = violations
  }
  expect(found).toEqual({})
})
