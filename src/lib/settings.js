const KEY = 'inclusive-games:settings'

const DEFAULTS = {
  soundEnabled: true,
  textSize: 'normal',
  reducedMotion: false,
  theme: 'system',
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
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

export function applySettings(settings) {
  const root = document.documentElement
  root.dataset.textSize = settings.textSize
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
  return getSettings().reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
