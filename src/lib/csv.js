// Excel is the target here, not a parser: teachers open these files to build a
// report or show a parent. Two details matter for that and are easy to get
// wrong — the separator and the byte order mark. See toCsv/downloadCsv below.

const SEPARATOR = ';'

function escapeCell(value) {
  if (value === null || value === undefined) return ''

  const text = String(value)
  // A cell needs quoting if it contains the separator, a quote or a line break;
  // inner quotes are doubled, per RFC 4180.
  if (text.includes(SEPARATOR) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

/**
 * Rows in, CSV text out. Semicolon-separated because Excel picks its column
 * separator from the system list separator, which is ";" in Ukrainian and most
 * European locales — a comma-separated file lands there as one column of text.
 * Google Sheets detects either.
 */
export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(SEPARATOR)).join('\r\n')
}

export function formatCsvDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n) => String(n).padStart(2, '0')
  // Written out by hand rather than via toLocaleString: this is data a
  // spreadsheet has to sort, so it must not shift with the viewer's locale.
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * One row per attempt — raw data a teacher can sort and pivot, rather than a
 * pre-chewed summary. Students with no attempts still get a row, otherwise they
 * silently vanish from the export and look like they were never in the group.
 */
export function buildGroupCsv({ students, results, gameTitles = {} }) {
  const header = ['Учень', 'Гра', 'Рівень', 'Бал', 'Дата']
  const rows = [header]

  const byStudent = new Map()
  for (const result of results) {
    if (!byStudent.has(result.user_id)) byStudent.set(result.user_id, [])
    byStudent.get(result.user_id).push(result)
  }

  for (const student of students) {
    const attempts = (byStudent.get(student.id) ?? []).slice().sort(
      (a, b) => new Date(a.played_at) - new Date(b.played_at),
    )

    if (attempts.length === 0) {
      rows.push([student.displayName, '—', '', '', ''])
      continue
    }

    for (const attempt of attempts) {
      rows.push([
        student.displayName,
        gameTitles[attempt.game_id] ?? attempt.game_id,
        attempt.level_id ?? '',
        attempt.score,
        formatCsvDate(attempt.played_at),
      ])
    }
  }

  return toCsv(rows)
}

export function csvFileName(groupName) {
  const slug = String(groupName)
    .trim()
    .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
    .replaceAll(/^-|-$/g, '')
  const today = new Date().toISOString().slice(0, 10)
  return `${slug || 'grupa'}-${today}.csv`
}

/** Hands the browser a finished CSV as a download. */
export function downloadCsv(fileName, csvText) {
  // The BOM is what stops Excel on Windows reading Cyrillic as mojibake; it
  // guesses the system codepage otherwise, whatever the bytes actually are.
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
