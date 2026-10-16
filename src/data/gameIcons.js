/**
 * Картинка для кожної гри — для режиму «без читання»: дитина, що ще не
 * читає, шукає гру очима, а не за назвою. Емодзі, бо вони кольорові, не
 * важать нічого і однаково зрозумілі на всіх системах; лише ті, що є в
 * старих системах (без найновіших символів), щоб на шкільному комп'ютері не
 * з'явився порожній квадрат.
 */
export const GAME_ICONS = {
  schulte: '🔢',
  stroop: '🎨',
  'day-night': '🌗',
  'go-no-go': '🟢',
  'card-sort': '🃏',
  trail: '🔗',
  subitizing: '🎲',
  simon: '🎹',
  'memory-pairs': '🧩',
  'quick-math': '➕',
  'reaction-time': '⚡',
  'keyboard-trainer': '⌨️',
  'n-back': '🔁',
  'target-search': '🔍',
  matrices: '🔳',
  'mental-rotation': '🔄',
  'traffic-light': '🚦',
  'catch-the-moment': '🎯',
  'what-vanished': '👀',
  'digit-span': '🔟',
  'odd-one-out': '🍏',
  'continue-row': '➡️',
  tower: '🗼',
  'number-line': '📏',
  emotions: '😊',
  rhythm: '🥁',
  'first-sound': '🔤',
  'word-groups': '🗂️',
  'graphic-dictation': '✏️',
  'left-right': '🤚',
  'trace-path': '✍️',
  flanker: '🐟',
  'hidden-figures': '🖼️',
  'more-dots': '🔵',
  seriation: '📶',
  analogies: '↔️',
  'listen-catch': '👂',
  'story-order': '📖',
  'ten-words': '📝',
  'object-place': '📦',
  maze: '🌀',
  'time-sense': '⏱️',
  symmetry: '🦋',
}

export function gameIcon(id) {
  return GAME_ICONS[id] ?? '🎮'
}
