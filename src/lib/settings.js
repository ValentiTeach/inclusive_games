const KEY = 'inclusive-games:settings'

const DEFAULTS = {
  soundEnabled: true,
  textSize: 'normal',
  reducedMotion: false,
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

export function applySettings(settings) {
  document.documentElement.dataset.textSize = settings.textSize
  document.documentElement.classList.toggle('force-reduced-motion', settings.reducedMotion)
}
