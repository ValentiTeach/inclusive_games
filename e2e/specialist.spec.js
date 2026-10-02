import { test, expect } from '@playwright/test'
import { signInAsTeacher, makeResults, TEACHER_ID } from './support/teacher.js'

const GROUP = { id: 'g1', name: '2-Б клас', join_code: 'ABC123', created_at: '2026-09-01T10:00:00Z' }

function students() {
  return [
    { id: 'kid-1', display_name: 'Марійка', group_id: 'g1', created_at: '2026-09-02T10:00:00Z' },
    { id: 'kid-2', display_name: 'Тарас', group_id: 'g1', created_at: '2026-09-03T10:00:00Z' },
  ]
}

test.describe('сторінка групи', () => {
  test('без рейтингу групи, із заняттями й карткою дитини', async ({ page }) => {
    const kids = students()
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students: kids,
      results: makeResults(kids, 3),
    })
    await page.goto('/groups/g1')

    await expect(page.getByRole('heading', { name: 'Заняття' })).toBeVisible()
    // Порівняння лише з собою: місця в класі немає ніде.
    await expect(page.getByText('Рейтинг групи')).toHaveCount(0)

    await page.getByRole('link', { name: 'Марійка' }).click()
    await expect(page).toHaveURL(/\/groups\/g1\/students\/kid-1$/)
    await expect(page.getByRole('heading', { name: 'Марійка' })).toBeVisible()
  })
})

test.describe('конструктор заняття', () => {
  test('шаблон із бібліотеки призначається одній дитині', async ({ page }) => {
    const posted = []
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students: students(),
      posted,
    })
    await page.goto('/groups/g1/sessions/new')

    await page.getByRole('button', { name: /Саморегуляція/ }).click()
    await expect(page.getByLabel('Назва заняття')).toHaveValue('Саморегуляція')
    await expect(page.getByText('3. День і ніч')).toBeVisible()

    // Крок можна переставити й прибрати.
    await page.getByRole('button', { name: 'Прибрати крок 7' }).click()
    await page.getByLabel('Кому').selectOption('kid-2')
    await page.getByRole('button', { name: 'Призначити' }).click()

    await expect(page).toHaveURL(/\/groups\/g1$/)
    const plan = posted.find((entry) => entry.table === 'session_plans').payload
    expect(plan.student_id).toBe('kid-2')
    expect(plan.title).toBe('Саморегуляція')
    expect(plan.steps.at(0)).toEqual({ kind: 'greeting' })
    expect(plan.steps.at(-1)).toEqual({ kind: 'reflection' })
    expect(plan.steps).toHaveLength(7)
    expect(plan.max_minutes).toBe(25)
  })

  test('перегляд як дитина показує розклад «спочатку — потім»', async ({ page }) => {
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP, students: students() })
    await page.goto('/groups/g1/sessions/new')
    await page.getByRole('button', { name: /Робоча пам/ }).click()
    await page.getByRole('link', { name: /Переглянути як дитина/ }).click()

    await expect(page.getByText('Нічого не зберігається')).toBeVisible()
    await page.getByRole('button', { name: 'Почати заняття' }).click()
    await expect(page.locator('.schedule__first-then')).toContainText('Спочатку: Привіт')
    await expect(page.locator('.schedule__first-then')).toContainText('потім: Дихаємо')

    await page.getByRole('button', { name: 'Добре' }).click()
    await page.getByRole('button', { name: 'Почнімо' }).click()
    // Перший крок позначено пройденим, поточний — дихання.
    await expect(page.locator('.schedule__card.is-done')).toHaveCount(1)
    await expect(page.locator('.schedule__card.is-current')).toContainText('Дихаємо')
    await expect(page.getByText(/Вдих|Видих/)).toBeVisible()
  })
})

test.describe('картка дитини', () => {
  test('профіль адаптацій зберігається без діагнозу', async ({ page }) => {
    const posted = []
    await signInAsTeacher(page, {
      groups: [GROUP],
      group: GROUP,
      students: students(),
      posted,
    })
    await page.goto('/groups/g1/students/kid-1')

    await page.getByLabel(/Затримка активації/).check()
    await page.getByLabel(/Сенсорно-безпечний режим/).check()
    await page.getByRole('button', { name: 'Зберегти профіль' }).click()
    await expect(page.getByText('Збережено.')).toBeVisible()

    const saved = posted.find((entry) => entry.table === 'student_adaptations').payload
    expect(saved.student_id).toBe('kid-1')
    expect(saved.settings.holdMs).toBe(500)
    expect(saved.settings.sensorySafe).toBe(true)
    expect(JSON.stringify(saved)).not.toMatch(/РАС|тремор|діагноз/)
  })

  test('щоденник шифрується в браузері: на сервер іде ключ під паролем, а не пароль', async ({
    page,
  }) => {
    const posted = []
    await signInAsTeacher(page, { groups: [GROUP], group: GROUP, students: students(), posted })
    await page.goto('/groups/g1/students/kid-1')
    await expect(page.getByRole('heading', { name: 'Захищений щоденник' })).toBeVisible()
    await expect(page.getByText('Відновити його неможливо')).toBeVisible()

    const secret = 'дуже довгий пароль щоденника'
    await page.getByLabel('Пароль щоденника').fill(secret)
    await page.getByLabel('Ще раз').fill(secret)
    await page.getByRole('button', { name: 'Створити щоденник' }).click()
    await expect(page.getByText('Щоденник відімкнено в цій вкладці.')).toBeVisible({
      timeout: 15000,
    })

    const vault = posted.find((entry) => entry.table === 'specialist_vaults').payload
    expect(vault.wrapped_key).toMatch(/^w1\./)
    expect(vault.iterations).toBe(600000)
    expect(JSON.stringify(vault)).not.toContain(secret)
  })
})

test.describe('профіль адаптацій у грі', () => {
  test('шрифт для дислексії, одна кнопка і м’які кольори діють у грі', async ({ page }) => {
    await signInAsTeacher(page, {
      profile: { display_name: 'Марійка', group_id: 'g1', role: 'student' },
      adaptations: [
        {
          student_id: TEACHER_ID,
          settings: { dyslexiaFont: true, scanMs: 1200, sensorySafe: true, colorSafe: true },
          updated_at: '2026-10-01T10:00:00Z',
        },
      ],
    })
    await page.goto('/games/stroop')

    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-dyslexia-font', 'on')
    await expect(root).toHaveAttribute('data-sensory-safe', 'on')
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(font).toContain('Andika')

    await page.getByRole('button', { name: 'Почати' }).click()
    await expect(page.getByRole('button', { name: 'Вибрати' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-scan-current]')).toHaveCount(1)

    // Червоний варіант Струпа намальовано кольором без червоно-зеленої пари.
    const swatch = await page
      .locator('.stroop__option', { hasText: 'Червоний' })
      .locator('.stroop__swatch')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(swatch).toBe('rgb(213, 94, 0)')
  })

  test('налаштування показують, що ввімкнув фахівець', async ({ page }) => {
    await signInAsTeacher(page, {
      profile: { display_name: 'Марійка', group_id: 'g1', role: 'student' },
      adaptations: [{ student_id: TEACHER_ID, settings: { shortTrials: 6 } }],
    })
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Налаштував фахівець' })).toBeVisible()
    await expect(page.getByText('Коротші спроби: до 6')).toBeVisible()
  })
})
