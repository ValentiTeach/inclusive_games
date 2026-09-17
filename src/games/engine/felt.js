/**
 * Як дитині було. Три відповіді, більше не треба: шкала на п'ять поділок
 * питає точність там, де дитина має лише відчуття.
 *
 * Порядок від легкого до важкого — так само, як ідуть рівні складності, щоб
 * кнопки читалися без роздумів.
 */
export const FELT_OPTIONS = [
  { id: 'easy', label: 'Легко' },
  { id: 'ok', label: 'Нормально' },
  { id: 'hard', label: 'Важко' },
]

export const FELT_IDS = FELT_OPTIONS.map((option) => option.id)

export const FELT_LABELS = Object.fromEntries(
  FELT_OPTIONS.map(({ id, label }) => [id, label]),
)
