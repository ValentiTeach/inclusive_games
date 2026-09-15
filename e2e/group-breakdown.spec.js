import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeStudents, makeResults } from './support/teacher.js'

const GROUP = { id: 'g1', name: '5-А клас', join_code: 'ABC123', created_at: '2026-09-01T10:00:00Z' }

/**
 * Зріз групи за іграми. Дев'ятнадцять ігор пишуть у базу докладні показники, і
 * досі жоден із них не був видний учителю — сторінка групи показувала лише
 * «скільки спроб» і середній бал по всіх іграх разом.
 */
test.describe('зріз групи за іграми', () => {
  async function openGroup(page, { students = 3, perStudent = 3 } = {}) {
    const list = makeStudents(students)
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students: list,
      results: makeResults(list, perStudent),
    })
    await page.goto('/groups/g1')
    await expect(page.getByRole('heading', { name: 'Зріз за іграми' })).toBeVisible()
    return list
  }

  test('показує рядок на кожну гру з показниками', async ({ page }) => {
    await openGroup(page)

    const rows = page.locator('.breakdown__row')
    await expect(rows.first()).toBeVisible()

    // Точність і час реакції — саме ті числа, яких раніше не було видно.
    await expect(page.locator('.breakdown__table')).toContainText('%')
    await expect(page.locator('.breakdown__table')).toContainText('мс')
  })

  test('рядок розгортається і показує кожного учня окремо', async ({ page }) => {
    const students = await openGroup(page)

    await expect(page.locator('.breakdown__student')).toHaveCount(0)
    await page.locator('.breakdown__toggle').first().click()

    const names = page.locator('.breakdown__student-name')
    await expect(names.first()).toBeVisible()
    const shown = await names.allTextContents()
    for (const name of shown) {
      expect(students.map((s) => s.display_name)).toContain(name)
    }
  })

  test('розкрита лише одна гра за раз', async ({ page }) => {
    await openGroup(page)

    await page.locator('.breakdown__toggle').first().click()
    await expect(page.locator('.breakdown__details')).toHaveCount(1)

    await page.locator('.breakdown__toggle').nth(1).click()
    await expect(page.locator('.breakdown__details')).toHaveCount(1)
  })

  test('на телефоні таблиця стає картками, нічого не їде вбік', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await openGroup(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow, 'горизонтальної прокрутки бути не має').toBe(false)

    // Підпис колонки переїжджає в картку.
    const label = await page.locator('.breakdown__row td[data-label="Спроб"]').first()
      .evaluate((node) => getComputedStyle(node, '::before').content)
    expect(label).toContain('Спроб')
  })

  test('порожня група пояснює, що тут буде', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP, students: [], results: [] })
    await page.goto('/groups/g1')

    await expect(page.locator('.breakdown__table')).toHaveCount(0)
  })
})
