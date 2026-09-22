import { describe, it, expect } from 'vitest'
import {
  assignmentProgress,
  countsToward,
  isMissingTable,
  isOverdue,
  openAssignments,
} from './assignments'

const ASSIGNMENT = {
  id: 'a1',
  group_id: 'g1',
  game_id: 'schulte',
  level_id: null,
  target_attempts: 2,
  due_on: '2026-09-20',
  created_at: '2026-09-10T08:00:00Z',
}

const attempt = (over = {}) => ({
  user_id: 's1',
  game_id: 'schulte',
  level_id: 'classic',
  played_at: '2026-09-11T10:00:00Z',
  ...over,
})

const STUDENTS = [
  { id: 's1', displayName: 'Аня' },
  { id: 's2', displayName: 'Богдан' },
]

describe('яка спроба зараховується', () => {
  it('гра має збігатися', () => {
    expect(countsToward(ASSIGNMENT, attempt())).toBe(true)
    expect(countsToward(ASSIGNMENT, attempt({ game_id: 'stroop' }))).toBe(false)
  })

  /**
   * Інакше клас, який грав у Шульте минулого тижня, виконав би завдання ще до
   * того, як його почув.
   */
  it('спроба до видачі завдання не рахується', () => {
    expect(countsToward(ASSIGNMENT, attempt({ played_at: '2026-09-09T10:00:00Z' }))).toBe(false)
    expect(countsToward(ASSIGNMENT, attempt({ played_at: '2026-09-10T08:00:00Z' }))).toBe(true)
  })

  /**
   * «Зіграйте 5×5» і «просто зіграйте» — різні завдання. Зарахувати 3×3
   * замість 5×5 означало б порахувати не те.
   */
  it('рівень звіряється, лише якщо він заданий', () => {
    const strict = { ...ASSIGNMENT, level_id: 'large' }

    expect(countsToward(strict, attempt({ level_id: 'classic' }))).toBe(false)
    expect(countsToward(strict, attempt({ level_id: 'large' }))).toBe(true)
    // Без рівня зараховується будь-який.
    expect(countsToward(ASSIGNMENT, attempt({ level_id: 'large' }))).toBe(true)
  })
})

describe('прогрес завдання', () => {
  it('рахує виконаних і тих, хто ще ні', () => {
    const results = [attempt(), attempt(), attempt({ user_id: 's2' })]
    const progress = assignmentProgress(ASSIGNMENT, STUDENTS, results)

    expect(progress.done.map((s) => s.displayName)).toEqual(['Аня'])
    expect(progress.pending.map((s) => s.displayName)).toEqual(['Богдан'])
    expect(progress.percent).toBe(50)
  })

  it('показує, скільки разів зіграв кожен', () => {
    const progress = assignmentProgress(ASSIGNMENT, STUDENTS, [attempt(), attempt()])

    expect(progress.done[0].played).toBe(2)
    expect(progress.pending[0].played).toBe(0)
  })

  it('спроби чужого учня не зараховуються групі', () => {
    const progress = assignmentProgress(ASSIGNMENT, STUDENTS, [
      attempt({ user_id: 'хтось' }),
      attempt({ user_id: 'хтось' }),
    ])

    expect(progress.done).toHaveLength(0)
  })

  /**
   * Порожня група — це не «всі впорались»: ділити на нуль тут не можна ані
   * арифметично, ані за змістом.
   */
  it('порожня група не дає ста відсотків', () => {
    const progress = assignmentProgress(ASSIGNMENT, [], [])

    expect(progress.percent).toBe(0)
    expect(progress.total).toBe(0)
  })

  it('однієї спроби замало, коли задано дві', () => {
    const progress = assignmentProgress(ASSIGNMENT, STUDENTS, [attempt()])

    expect(progress.done).toHaveLength(0)
    expect(progress.pending[0].played).toBe(1)
  })
})

describe('що бачить дитина', () => {
  it('виконані завдання зникають зі списку', () => {
    const mine = [attempt(), attempt()]

    expect(openAssignments([ASSIGNMENT], mine, 's1')).toEqual([])
    expect(openAssignments([ASSIGNMENT], mine, 's2')).toEqual([ASSIGNMENT])
  })

  it('недовиконане лишається видимим', () => {
    expect(openAssignments([ASSIGNMENT], [attempt()], 's1')).toEqual([ASSIGNMENT])
  })
})

describe('строк', () => {
  it('минулий строк позначається простроченим', () => {
    expect(isOverdue(ASSIGNMENT, new Date('2026-09-21T00:00:00Z'))).toBe(true)
  })

  it('до кінця дня строк ще не минув', () => {
    // 20:00 UTC — це 23:00 у Києві того ж дня, строк ще чинний.
    expect(isOverdue(ASSIGNMENT, new Date('2026-09-20T20:00:00Z'))).toBe(false)
  })

  /**
   * Строк минає опівночі за годинником дитини, а не за Гринвічем. 23:00 UTC
   * двадцятого — це вже 02:00 двадцять першого в Києві, і вчорашнє завдання
   * прострочене. Раніше воно ще дві-три години вважалося чинним.
   */
  it('після місцевої півночі строк уже минув', () => {
    expect(isOverdue(ASSIGNMENT, new Date('2026-09-20T23:00:00Z'))).toBe(true)
  })

  it('завдання без строку ніколи не прострочене', () => {
    expect(isOverdue({ ...ASSIGNMENT, due_on: null }, new Date('2030-01-01'))).toBe(false)
  })
})

describe('база без міграції', () => {
  /**
   * Міграція застосовується окремо від викладки коду. У проміжку фронт уже вміє
   * завдання, а база ще ні — і це єдиний випадок, коли мовчазне «завдань немає»
   * чесніше за повідомлення про помилку: учитель нічого не зламав.
   */
  it('впізнає відсутню таблицю за кодом помилки', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
  })

  it('решту помилок не ховає', () => {
    expect(isMissingTable({ code: '42501' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
