import { getActiveAdaptations } from './adaptations'

const KEY = 'inclusive-games:settings'

const DEFAULTS = {
  sound: 'clicks',
  textSize: 'normal',
  reducedMotion: false,
  theme: 'system',
  voice: 'button',
  pace: 'normal',
  errorFeedback: 'standard',
}

export const SOUND_MODES = ['off', 'clicks', 'music']

/**
 * Озвучення інструкцій окремо від звуку: «Тихо» вимикає сигнали й музику, але
 * дитині, яка не читає, голос потрібен і тоді. 'button' — голос лише на
 * натискання, 'auto' — інструкція звучить сама, щойно відкрито гру.
 */
export const VOICE_MODES = ['off', 'button', 'auto']

/**
 * Темп ігор. 'relaxed' — «без поспіху»: довше показ, ширше вікно відповіді й
 * бал без штрафу за час там, де гра це дозволяє. Для дитини з повільним темпом
 * чи моторними труднощами звичайний таймер міряє руку, а не увагу.
 */
export const PACE_MODES = ['normal', 'relaxed']

/**
 * Реакція на помилку. 'standard' — колір помилки й різкий сигнал, як було.
 * 'gentle' — нейтральний колір, тихий тон і спокійне «Спробуй ще» від
 * Совеняти: червоний хрестик і зумер для тривожної дитини читаються як
 * покарання, а не як підказка.
 */
export const ERROR_FEEDBACK_MODES = ['standard', 'gentle']

/**
 * Раніше звук був перемикачем «увімк./вимк.». Той, хто його вимкнув, зробив це
 * не випадково: тиша буває умовою, за якої дитина взагалі може займатися.
 * Просто додати нове поле зі значенням за замовчуванням означало б увімкнути
 * звук назад усім таким дітям — тому старе «вимкнено» читається як 'off'.
 */
function migrate(stored) {
  if (typeof stored.sound === 'string' && SOUND_MODES.includes(stored.sound)) {
    return stored
  }
  if (stored.soundEnabled === false) {
    return { ...stored, sound: 'off' }
  }
  return stored
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...migrate(JSON.parse(raw)) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /*
     * Приватне вікно або заборонені дані сайту. Налаштування діють до кінця
     * сеансу і просто не переживуть закриття вкладки — це краще, ніж сторінка
     * налаштувань, яка падає на кожному натисканні.
     */
  }
}

/**
 * Змінює одне налаштування з будь-якого місця, не лише зі сторінки налаштувань:
 * «без поспіху» вмикають і просто перед грою, поки дитина вже сидить поруч.
 */
export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch }
  saveSettings(next)
  return next
}

/**
 * Turns the stored preference into the theme actually painted.
 *
 * The stylesheet only ever sees 'light' or 'dark' — 'system' is resolved here
 * rather than by a `prefers-color-scheme` media query, so the dark palette can
 * live in exactly one CSS block instead of being duplicated between a media
 * query and an attribute selector, where the two copies would drift apart.
 */
export function resolveTheme(theme, prefersDark) {
  if (theme === 'light' || theme === 'dark') return theme
  return prefersDark ? 'dark' : 'light'
}

export function systemPrefersDark() {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

/**
 * Сенсорно-безпечний профіль від фахівця вмикає м'яку реакцію завжди: дитина
 * чи хтось поруч не має змоги випадково повернути їй зумер у налаштуваннях.
 */
export function errorFeedbackMode() {
  if (getActiveAdaptations().sensorySafe) return 'gentle'
  return getSettings().errorFeedback === 'gentle' ? 'gentle' : 'standard'
}

export function applySettings(settings) {
  const root = document.documentElement
  root.dataset.textSize = settings.textSize
  root.dataset.errorFeedback = settings.errorFeedback === 'gentle' ? 'gentle' : 'standard'
  root.classList.toggle('force-reduced-motion', settings.reducedMotion)

  const resolved = resolveTheme(settings.theme, systemPrefersDark())
  root.dataset.theme = resolved
  // Keeps scrollbars, form controls and other browser-painted chrome on the
  // same side as the page; without it a dark page keeps light scrollbars.
  root.style.colorScheme = resolved
}

/**
 * Re-applies the theme when the OS switches while the user is on 'system'.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(onChange) {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!query) return () => {}

  const handler = () => {
    if (getSettings().theme === 'system') onChange()
  }
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}

export function prefersReducedMotion() {
  return getSettings().reducedMotion || getActiveAdaptations().sensorySafe || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
