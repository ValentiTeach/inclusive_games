/**
 * Учительський вигляд у E2E без справжнього входу.
 *
 * Вхід вчителя — це magic-link поштою, і автоматизувати його не вийде. Через це
 * всі сторінки за авторизацією (групи, список учнів, адмінка) досі не мали
 * жодного E2E: тести ходили лише гостем.
 *
 * Тут сесія кладеться прямо в localStorage, а відповіді PostgREST підміняються
 * маршрутизатором. Токен несправжній, але supabase-js перевіряє підпис не сам —
 * він просто читає збережену сесію, — а мережі тут узагалі немає. Тож
 * перевіряються справжні компоненти зі справжніми стилями на справжніх даних,
 * тільки ці дані описані в тесті.
 *
 * Ключ `sb-e2e-auth-token` походить від VITE_SUPABASE_URL у playwright.config.js
 * (`https://e2e.invalid` → ref `e2e`). Зміниться URL — зміниться і ключ.
 */

export const TEACHER_ID = '11111111-2222-4333-8444-555555555555'

const SESSION = {
  access_token: 'e2e.fake.token',
  refresh_token: 'e2e-fake-refresh',
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: TEACHER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'teacher@test.local',
    is_anonymous: false,
    app_metadata: {},
    user_metadata: { display_name: 'Вчителька' },
    created_at: '2026-01-01T00:00:00Z',
  },
}

export function makeStudents(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${index}`,
    display_name: `Учень Довге-Прізвище ${index + 1}`,
    created_at: `2026-09-0${(index % 9) + 1}T10:00:00Z`,
  }))
}

export function makeResults(students, perStudent = 3) {
  return students.flatMap((student, studentIndex) =>
    Array.from({ length: perStudent }, (_, index) => ({
      user_id: student.id,
      game_id: ['schulte', 'stroop', 'memory-pairs'][index % 3],
      level_id: 'classic',
      score: 50 + ((studentIndex * 7 + index * 13) % 50),
      // total і rt_count тут не для краси: без них зріз за іграми не має чим
      // зважувати середні, і перевірка зважування перетворилася б на перевірку
      // простого середнього.
      metrics: {
        total: 10 + index * 5,
        accuracy_pct: 60 + index * 5,
        avg_rt_ms: 400 + index * 40,
        rt_count: 10 + index * 5,
      },
      played_at: `2026-09-0${(index % 9) + 1}T11:00:00Z`,
    })),
  )
}

/**
 * @param fixtures.groups   список груп для /groups
 * @param fixtures.group    одна група для /groups/:id
 * @param fixtures.students учні групи
 * @param fixtures.results  спроби учнів
 */
export async function signInAsTeacher(page, fixtures = {}) {
  const {
    groups = [],
    group = groups[0] ?? null,
    students = [],
    results = [],
    profile = { display_name: 'Вчителька', group_id: null, role: 'teacher' },
    /*
     * null означає «таблиці assignments у базі ще немає»: міграція
     * застосовується окремо від викладки коду, і в цьому проміжку сторінка має
     * мовчки обійтися без розділу, а не показувати помилку.
     */
    assignments = [],
    /*
     * Список для адмін-панелі. Він приходить не з таблиці, а з RPC
     * admin_list_users, тож підміняється окремо від решти.
     */
    allUsers = [],
    /*
     * Батьківський бік: зв'язки «дорослий → дитина», відповідь на введений код
     * і спроби дитини. redeemed — це те, що поверне RPC redeem_parent_invite:
     * або id дитини, або текст помилки сервера.
     */
    parentLinks = [],
    redeemed = null,
  } = fixtures

  await page.addInitScript((session) => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify(session))
  }, SESSION)

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/rest/v1/', '')
    const select = url.searchParams.get('select') ?? ''

    if (path === 'rpc/create_parent_invite') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('KRDM47XZ'),
      })
      return
    }

    if (path === 'rpc/redeem_parent_invite') {
      if (typeof redeemed === 'string' && redeemed.includes('_')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'P0001', message: redeemed, details: redeemed }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(redeemed),
      })
      return
    }

    if (path === 'rpc/admin_list_users') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(allUsers),
      })
      return
    }

    if (path === 'assignments' && assignments === null) {
      // Так PostgREST відповідає на запит до таблиці, якої немає.
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PGRST205',
          message: "Could not find the table 'public.assignments' in the schema cache",
        }),
      })
      return
    }

    if (path === 'assignments' && request.method() === 'POST') {
      const created = {
        id: `a${assignments.length + 1}`,
        created_at: new Date().toISOString(),
        ...JSON.parse(request.postData() ?? '{}'),
      }
      assignments.push(created)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
      return
    }

    if (path === 'assignments' && request.method() === 'DELETE') {
      assignments.length = 0
      await route.fulfill({ status: 204, contentType: 'application/json', body: '' })
      return
    }

    let body = []
    if (path === 'parent_links') body = parentLinks
    else if (path === 'profiles' && select.includes('role')) body = [profile]
    else if (path === 'profiles') body = students
    else if (path === 'groups') body = group && url.searchParams.has('id') ? [group] : groups
    else if (path === 'results') body = results
    else if (path === 'assignments') body = assignments

    // PostgREST віддає один обʼєкт замість масиву, коли клієнт просить .single();
    // supabase-js позначає це заголовком Accept.
    const wantsObject = (request.headers().accept ?? '').includes('vnd.pgrst.object')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsObject ? (body[0] ?? null) : body),
    })
  })
}
