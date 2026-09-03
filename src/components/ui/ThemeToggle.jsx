import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import {
  getSettings,
  saveSettings,
  applySettings,
  resolveTheme,
  systemPrefersDark,
  watchSystemTheme,
} from '../../lib/settings'
import './ThemeToggle.css'

/**
 * One-click light/dark switch in the header. The three-way choice (including
 * "system") stays in Settings; here the button simply flips to the opposite of
 * what is currently painted, which is what someone reaching for a sun/moon icon
 * expects. Picking either side is an explicit choice, so "system" is left
 * behind at that point — Settings is where you go back to it.
 */
function ThemeToggle() {
  const [resolved, setResolved] = useState(() =>
    resolveTheme(getSettings().theme, systemPrefersDark()),
  )

  useEffect(() => watchSystemTheme(() => {
    setResolved(resolveTheme(getSettings().theme, systemPrefersDark()))
  }), [])

  function toggle() {
    const next = resolved === 'dark' ? 'light' : 'dark'
    const settings = { ...getSettings(), theme: next }
    saveSettings(settings)
    applySettings(settings)
    setResolved(next)
  }

  const goingDark = resolved !== 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={goingDark ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
      title={goingDark ? 'Темна тема' : 'Світла тема'}
    >
      {goingDark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  )
}

export default ThemeToggle
