import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeStudents, makeResults, TEACHER_ID } from './support/teacher.js'

/**
 * Дочекатися, поки сторінка справді сходила по завдання.
 *
 * Без цього перевірка «розділу немає» проходить сама собою: запит ще в дорозі,
 * елемента ще немає, і toHaveCount(0) відповідає «так» на порожньому місці.
 * Саме через це три мутації спершу лишалися невпійманими.
 */
async function waitForAssignmentsRequest(page, action) {
  const response = page.waitForResponse((res) => res.url().includes('/rest/v1/assignments'))
  await action()
  await response
}

const GROUP = { id: 'g1', name: '5-А клас', join_code: 'ABC123', created_at: '2026-09-01T10:00:00Z' }

/**
 * Завдання від учителя: «до п'ятниці зіграйте Шульте тричі».
 *
 * Досі платформа була набором вправ без адресата. Вдома цього достатньо, але на
 * уроці потрібне протилежне: назвати одну гру всьому класу й побачити, хто її
 * зробив.
 */
test.describe('учитель задає завдання', () => {
  async function openGroup(page, { assignments = [], perStudent = 0 } = {}) {
    const students = makeStudents(3)
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students,
      results: perStudent ? makeResults(students, perStudent) : [],
      assignments,
    })
    await waitForAssignmentsRequest(page, () => page.goto('/groups/g1'))
    return students
  }

  test('форма дозволяє задати гру, рівень, кількість і строк', async ({ page }) => {
    await openGroup(page)

    await expect(page.getByRole('heading', { name: 'Завдання класу' })).toBeVisible()
    await expect(page.locator('.assignments__form select')).toHaveCount(2)
    await expect(page.locator('.assignments__form input[type="number"]')).toBeVisible()
    await expect(page.locator('.assignments__form input[type="date"]')).toBeVisible()
  })

  test('задане завдання одразу зʼявляється у списку', async ({ page }) => {
    await openGroup(page)

    await expect(page.locator('.assignments__empty')).toBeVisible()
    await page.locator('.assignments__submit').click()

    await expect(page.locator('.assignments__item')).toHaveCount(1)
    await expect(page.locator('.assignments__count')).toContainText('0 з 3')
  })

  /**
   * Імена тих, хто ще не зробив, — це і є відповідь на питання, заради якого
   * учитель сюди дивиться.
   */
  test('видно, хто ще не виконав', async ({ page }) => {
    const students = await openGroup(page, {
      assignments: [
        {
          id: 'a1',
          group_id: 'g1',
          game_id: 'schulte',
          level_id: null,
          target_attempts: 1,
          due_on: null,
          created_at: '2020-01-01T00:00:00Z',
        },
      ],
      perStudent: 3,
    })

    await expect(page.locator('.assignments__item')).toHaveCount(1)
    // makeResults дає кожному учневі спроби в schulte, тож усі виконали.
    await expect(page.locator('.assignments__count')).toContainText(`3 з ${students.length}`)
    await expect(page.locator('.assignments__pending')).toHaveCount(0)
  })

  test('завдання, видане пізніше за спроби, ще не виконане', async ({ page }) => {
    await openGroup(page, {
      assignments: [
        {
          id: 'a1',
          group_id: 'g1',
          game_id: 'schulte',
          level_id: null,
          target_attempts: 1,
          due_on: null,
          // Спроби у фікстурі — з вересня 2026, а завдання видане пізніше.
          created_at: '2030-01-01T00:00:00Z',
        },
      ],
      perStudent: 3,
    })

    await expect(page.locator('.assignments__count')).toContainText('0 з 3')
    await expect(page.locator('.assignments__pending')).toBeVisible()
  })

  /**
   * Задано двічі, зіграно один раз. Без цього випадку всі перевірки жили б на
   * «один раз», де «зіграв» і «зіграв скільки просили» — те саме число.
   */
  test('одна спроба не закриває завдання на дві', async ({ page }) => {
    await openGroup(page, {
      assignments: [
        {
          id: 'a1',
          group_id: 'g1',
          game_id: 'schulte',
          level_id: null,
          target_attempts: 2,
          due_on: null,
          created_at: '2020-01-01T00:00:00Z',
        },
      ],
      // perStudent: 1 дає кожному рівно одну спробу, і саме в schulte.
      perStudent: 1,
    })

    await expect(page.locator('.assignments__count')).toContainText('0 з 3')
    await expect(page.locator('.assignments__pending')).toBeVisible()
  })

  /**
   * Міграція застосовується окремо від викладки коду. У проміжку сторінка має
   * працювати так, ніби розділу немає, — а не показувати помилку про таблицю.
   */
  test('без застосованої міграції розділ просто не показується', async ({ page }) => {
    await openGroup(page, { assignments: null })

    await expect(page.getByRole('heading', { name: 'Завдання класу' })).toHaveCount(0)
    // Решта сторінки працює як звичайно.
    await expect(page.getByText('5-А клас')).toBeVisible()
  })
})

test.describe('дитина бачить завдання', () => {
  const ASSIGNMENT = {
    id: 'a1',
    group_id: 'g1',
    game_id: 'schulte',
    level_id: null,
    target_attempts: 2,
    due_on: '2026-12-31',
    created_at: '2020-01-01T00:00:00Z',
  }

  async function asStudent(page, { results = [], assignments = [ASSIGNMENT] } = {}) {
    await signInAsTeacher(page, {
      profile: { display_name: 'Аня', group_id: 'g1', role: 'student' },
      groups: [GROUP],
      group: GROUP,
      students: [],
      results,
      assignments,
    })
    await waitForAssignmentsRequest(page, () => page.goto('/games'))
  }

  test('невиконане завдання видно просто над каталогом', async ({ page }) => {
    await asStudent(page)

    await expect(page.getByRole('heading', { name: /Завдання від учителя/ })).toBeVisible()
    await expect(page.locator('.assigned__link')).toContainText('Таблиці Шульте')
    await expect(page.locator('.assigned__meta')).toContainText('2 рази')
  })

  test('посилання веде саме в задану гру', async ({ page }) => {
    await asStudent(page)

    await page.locator('.assigned__link').click()
    await expect(page).toHaveURL(/\/games\/schulte$/)
  })

  /**
   * Список, у якому половина пунктів закреслена, читається як докір, а не як
   * підказка, що робити далі.
   */
  test('виконане завдання зникає', async ({ page }) => {
    await asStudent(page, {
      results: [
        { user_id: TEACHER_ID, game_id: 'schulte', level_id: 'classic', played_at: '2026-09-10T10:00:00Z' },
        { user_id: TEACHER_ID, game_id: 'schulte', level_id: 'classic', played_at: '2026-09-11T10:00:00Z' },
      ],
    })

    await expect(page.locator('.assigned')).toHaveCount(0)
  })

  /**
   * Задано два рази, зіграно один — завдання ще не виконане. Окремий тест, бо
   * саме тут видно різницю між «зіграв» і «зіграв скільки просили».
   */
  test('однієї спроби з двох замало, завдання лишається', async ({ page }) => {
    await asStudent(page, {
      results: [
        { user_id: TEACHER_ID, game_id: 'schulte', level_id: 'classic', played_at: '2026-09-10T10:00:00Z' },
      ],
    })

    await expect(page.locator('.assigned__link')).toContainText('Таблиці Шульте')
  })

  test('без завдань нічого зайвого не зʼявляється', async ({ page }) => {
    await asStudent(page, { assignments: [] })

    await expect(page.locator('.assigned')).toHaveCount(0)
  })
})
