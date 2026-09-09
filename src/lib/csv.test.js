import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toCsv, formatCsvDate, buildGroupCsv, csvFileName } from './csv'

describe('toCsv', () => {
  it('separates columns with a semicolon and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a;b\r\nc;d')
  })

  it('quotes a cell containing the separator', () => {
    expect(toCsv([['Іван; Петро']])).toBe('"Іван; Петро"')
  })

  it('doubles inner quotes and wraps the cell', () => {
    expect(toCsv([['клас "А"']])).toBe('"клас ""А"""')
  })

  it('quotes a cell containing a line break', () => {
    expect(toCsv([['перший\nдругий']])).toBe('"перший\nдругий"')
  })

  it('writes empty cells for null and undefined instead of the words', () => {
    expect(toCsv([[null, undefined, 0]])).toBe(';;0')
  })

  it('leaves ordinary text unquoted', () => {
    expect(toCsv([['Марічка', 85]])).toBe('Марічка;85')
  })
})

describe('formatCsvDate', () => {
  it('returns an empty cell for missing or unparsable input', () => {
    expect(formatCsvDate(null)).toBe('')
    expect(formatCsvDate(undefined)).toBe('')
    expect(formatCsvDate('not a date')).toBe('')
  })

  it('pads day, month, hour and minute to two digits', () => {
    expect(formatCsvDate('2026-03-05T07:09:00')).toBe('05.03.2026 07:09')
  })
})

describe('buildGroupCsv', () => {
  const students = [
    { id: 'u1', displayName: 'Марічка' },
    { id: 'u2', displayName: 'Іван' },
  ]

  it('starts with a header row', () => {
    const csv = buildGroupCsv({ students: [], results: [] })
    expect(csv).toBe('Учень;Гра;Рівень;Бал;Дата')
  })

  it('writes one row per attempt', () => {
    const csv = buildGroupCsv({
      students: [students[0]],
      results: [
        { user_id: 'u1', game_id: 'stroop', level_id: 'easy', score: 80, played_at: '2026-03-01T10:00:00' },
        { user_id: 'u1', game_id: 'stroop', level_id: 'hard', score: 95, played_at: '2026-03-02T10:00:00' },
      ],
    })

    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('Марічка;stroop;easy;80;01.03.2026 10:00')
    expect(lines[2]).toBe('Марічка;stroop;hard;95;02.03.2026 10:00')
  })

  // A student who joined but never played is still part of the group; dropping
  // them would make the export look like they were never there.
  it('keeps a row for a student with no attempts', () => {
    const csv = buildGroupCsv({ students, results: [] })
    const lines = csv.split('\r\n')

    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('Марічка;—;;;')
    expect(lines[2]).toBe('Іван;—;;;')
  })

  it('sorts each student\'s attempts oldest first', () => {
    const csv = buildGroupCsv({
      students: [students[0]],
      results: [
        { user_id: 'u1', game_id: 'simon', level_id: null, score: 60, played_at: '2026-03-09T10:00:00' },
        { user_id: 'u1', game_id: 'simon', level_id: null, score: 40, played_at: '2026-03-02T10:00:00' },
      ],
    })

    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('02.03.2026')
    expect(lines[2]).toContain('09.03.2026')
  })

  it('never mixes one student\'s attempts into another', () => {
    const csv = buildGroupCsv({
      students,
      results: [
        { user_id: 'u2', game_id: 'nback', level_id: null, score: 70, played_at: '2026-03-01T10:00:00' },
      ],
    })

    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('Марічка;—;;;')
    expect(lines[2]).toBe('Іван;nback;;70;01.03.2026 10:00')
  })

  it('prefers a readable game title over the raw id', () => {
    const csv = buildGroupCsv({
      students: [students[0]],
      results: [
        { user_id: 'u1', game_id: 'stroop', level_id: null, score: 50, played_at: '2026-03-01T10:00:00' },
      ],
      gameTitles: { stroop: 'Тест Струпа' },
    })

    expect(csv.split('\r\n')[1]).toContain('Тест Струпа')
  })

  it('falls back to the raw id for a game missing from the title map', () => {
    const csv = buildGroupCsv({
      students: [students[0]],
      results: [
        { user_id: 'u1', game_id: 'retired-game', level_id: null, score: 50, played_at: '2026-03-01T10:00:00' },
      ],
      gameTitles: { stroop: 'Тест Струпа' },
    })

    expect(csv.split('\r\n')[1]).toContain('retired-game')
  })

  it('escapes a display name that would otherwise break the columns', () => {
    const csv = buildGroupCsv({
      students: [{ id: 'u1', displayName: 'Іван; Петро' }],
      results: [],
    })

    expect(csv.split('\r\n')[1]).toBe('"Іван; Петро";—;;;')
  })
})

describe('csvFileName', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps Cyrillic letters and dates the file', () => {
    expect(csvFileName('4-А клас')).toBe('4-А-клас-2026-06-15.csv')
  })

  it('collapses punctuation and trims stray dashes', () => {
    expect(csvFileName('  Група #1 / "Б"  ')).toBe('Група-1-Б-2026-06-15.csv')
  })

  it('falls back to a generic name when nothing usable is left', () => {
    expect(csvFileName('///')).toBe('grupa-2026-06-15.csv')
  })
})

describe('buildGroupCsv — колонки вимірювань', () => {
  const marichka = { id: 'u1', displayName: 'Марічка' }

  function attempt(metrics, overrides = {}) {
    return {
      user_id: 'u1',
      game_id: 'stroop',
      level_id: 'easy',
      score: 75,
      played_at: '2026-03-01T10:00:00',
      metrics,
      ...overrides,
    }
  }

  it('gives every measurement its own column, under a Ukrainian heading', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [attempt({ accuracy_pct: 75, avg_rt_ms: 450 })],
    })
    const [header, row] = csv.split('\r\n')

    expect(header).toBe('Учень;Гра;Рівень;Бал;Дата;Точність, %;Сер. час, мс')
    expect(row).toBe('Марічка;stroop;easy;75;01.03.2026 10:00;75;450')
  })

  /**
   * Заголовок не фіксований навмисно: ігри міряють різне. Жорсткий список або
   * ніс би колонки, в які ця група ніколи не грала, або тихо викидав би
   * показники окремої гри.
   */
  it('carries the union of what the group actually played', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [
        attempt({ accuracy_pct: 75, avg_rt_ms: 450 }),
        attempt({ grid_size: 5, duration_ms: 42_345 }, { game_id: 'schulte' }),
      ],
    })
    const [header, stroopRow, schulteRow] = csv.split('\r\n')

    expect(header).toContain('Розмір таблиці')
    expect(header).toContain('Сер. час, мс')
    // Кожен рядок лишає порожнім те, чого його гра не міряє.
    expect(stroopRow.endsWith(';;')).toBe(true)
    expect(schulteRow).toContain('42345')
  })

  it('leaves the cells blank for an attempt played before metrics existed', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [attempt({ accuracy_pct: 75 }), attempt(undefined)],
    })
    const [, withMetrics, without] = csv.split('\r\n')

    expect(withMetrics).toBe('Марічка;stroop;easy;75;01.03.2026 10:00;75')
    expect(without).toBe('Марічка;stroop;easy;75;01.03.2026 10:00;')
  })

  it('keeps a measured zero, which is not the same as a blank', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [attempt({ errors: 0 })],
    })

    expect(csv.split('\r\n')[1].endsWith(';0')).toBe(true)
  })

  it('writes a boolean as a word a teacher can filter on', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [attempt({ reached_target: false }, { game_id: 'simon' })],
    })

    expect(csv.split('\r\n')[1].endsWith(';ні')).toBe(true)
  })

  it('pads the row of a student who never played, so columns stay aligned', () => {
    const csv = buildGroupCsv({
      students: [marichka, { id: 'u2', displayName: 'Іван' }],
      results: [attempt({ accuracy_pct: 75, avg_rt_ms: 450 })],
    })
    const lines = csv.split('\r\n')
    const columns = (line) => line.split(';').length

    expect(columns(lines[2])).toBe(columns(lines[0]))
  })

  // Порядок колонок не має плавати від того, у якому порядку діти грали:
  // вчитель зберігає ці файли й порівнює їх між тижнями.
  it('orders the columns the same way regardless of attempt order', () => {
    const shared = { students: [marichka] }
    const a = attempt({ grid_size: 5 }, { game_id: 'schulte' })
    const b = attempt({ accuracy_pct: 75 })

    const first = buildGroupCsv({ ...shared, results: [a, b] }).split('\r\n')[0]
    const second = buildGroupCsv({ ...shared, results: [b, a] }).split('\r\n')[0]

    expect(first).toBe(second)
  })

  it('exports an unknown measurement under its raw key rather than dropping it', () => {
    const csv = buildGroupCsv({
      students: [marichka],
      results: [attempt({ zebra_count: 3 })],
    })

    expect(csv.split('\r\n')[0]).toContain('zebra_count')
  })
})
