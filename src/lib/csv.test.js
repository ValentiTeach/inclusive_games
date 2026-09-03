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
