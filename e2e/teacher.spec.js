import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeStudents, makeResults } from './support/teacher.js'

const GROUP = { id: 'g1', name: '5-А клас', join_code: 'ABC123', created_at: '2026-09-01T10:00:00Z' }

/**
 * Перші E2E за авторизацією. Досі всі 32 тести ходили гостем, і учительський
 * шлях — вхід, група, код, список учнів — не перевіряв жоден автоматичний тест.
 */
test.describe('онбординг вчителя', () => {
  test('перший вхід закінчується розумінням, що робити далі', async ({ page }) => {
    await signInAsTeacher(page, { groups: [] })
    await page.goto('/groups')

    // Було: «У тебе ще немає жодної групи» — констатація без підказки.
    const steps = page.locator('.groups__steps li')
    await expect(steps).toHaveCount(3)
    await expect(steps.first()).toContainText('Створи групу')
    await expect(page.locator('.groups__steps')).toContainText('/join')
  })

  test('кроки зникають, щойно група зʼявилась', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP] })
    await page.goto('/groups')

    await expect(page.getByText('5-А клас')).toBeVisible()
    await expect(page.locator('.groups__steps')).toHaveCount(0)
  })

  /**
   * Код — головне, що вчителю потрібно з цієї сторінки на уроці: його диктують
   * класу або показують з екрана. Раніше він лежав дрібним рядком усередині
   * речення.
   */
  test('код групи видно з відстані', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP })
    await page.goto('/groups/g1')

    const code = page.locator('.group-detail__code')
    await expect(code).toHaveText('ABC123')

    const size = await code.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))
    expect(size).toBeGreaterThanOrEqual(30)
  })

  test('сторінка каже, куди дітям іти', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP })
    await page.goto('/groups/g1')

    await expect(page.locator('.group-detail__join-where')).toContainText('/join')
  })

  test('порожня група пояснює, що буде далі, а не лише констатує', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP, students: [] })
    await page.goto('/groups/g1')

    await expect(page.locator('.group-detail__empty')).toContainText('зʼявиться список')
  })
})

test.describe('сторінки вчителя на малих екранах', () => {
  const PHONE = { width: 360, height: 740 }
  const TABLET = { width: 768, height: 1024 }

  for (const [name, viewport] of [['телефон', PHONE], ['планшет', TABLET]]) {
    test(`${name}: нічого не їде вбік`, async ({ page }) => {
      const students = makeStudents(6)
      await signInAsTeacher(page, {
        groups: [GROUP],
        group: GROUP,
        students,
        results: makeResults(students),
      })
      await page.setViewportSize(viewport)

      for (const path of ['/groups', '/groups/g1']) {
        await page.goto(path)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${path} на ${name}`).toBe(0)
      }
    })

    /**
     * Таблиця учнів має 731 px на шість колонок: у вікні 360 px було видно дві
     * з них. Нижче 900 px кожен рядок стає карткою.
     */
    test(`${name}: список учнів стає картками`, async ({ page }) => {
      const students = makeStudents(3)
      await signInAsTeacher(page, {
        groups: [GROUP],
        group: GROUP,
        students,
        results: makeResults(students),
      })
      await page.setViewportSize(viewport)
      await page.goto('/groups/g1')

      const row = page.locator('.group-detail__table tbody tr').first()
      await expect(row).toHaveCSS('display', 'block')

      // Підписи колонок переїжджають у клітинки — інакше число «3» без
      // заголовка нічого не означає.
      const labels = await row.evaluate((node) =>
        [...node.querySelectorAll('td')].map((cell) => cell.dataset.label ?? null),
      )
      expect(labels).toContain('Спроб')
      expect(labels).toContain('Середній бал')
    })
  }

  test('на десктопі мишею таблиця лишається таблицею', async ({ page }) => {
    const students = makeStudents(3)
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students,
      results: makeResults(students),
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/groups/g1')

    await expect(page.locator('.group-detail__table tbody tr').first()).toHaveCSS(
      'display',
      'table-row',
    )
  })
})

/**
 * Ширина екрана нічого не каже про спосіб вводу. Планшет лежачи має 1024 px і
 * зберігає таблицю — але кнопки дій у ній були 28 px, а це дотик.
 */
test.describe('планшет лежачи, дотиком', () => {
  test.use({ hasTouch: true })

  test('кнопки дій виростають до цілі для пальця', async ({ page }) => {
    const students = makeStudents(3)
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students,
      results: makeResults(students),
    })
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/groups/g1')

    const box = await page.locator('.group-detail__icon-btn').first().boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
  })
})
