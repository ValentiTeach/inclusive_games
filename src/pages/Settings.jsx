import { useState } from 'react'
import { getSettings, saveSettings, applySettings } from '../lib/settings'
import './Settings.css'

function Settings() {
  const [settings, setSettings] = useState(() => getSettings())

  function update(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    applySettings(next)
  }

  return (
    <section className="settings">
      <h1>Налаштування</h1>
      <p>Зберігаються лише в цьому браузері, на цьому пристрої.</p>

      <div className="settings__row">
        <div>
          <h2>Звук</h2>
          <p>Короткі сигнали на кнопках і за правильні чи неправильні відповіді.</p>
        </div>
        <button
          type="button"
          className={settings.soundEnabled ? 'settings__toggle is-on' : 'settings__toggle'}
          onClick={() => update({ soundEnabled: !settings.soundEnabled })}
          aria-pressed={settings.soundEnabled}
        >
          {settings.soundEnabled ? 'Увімкнено' : 'Вимкнено'}
        </button>
      </div>

      <div className="settings__row">
        <div>
          <h2>Розмір тексту</h2>
          <p>Збільшений текст зручніше читати на екрані.</p>
        </div>
        <div className="settings__options">
          <button
            type="button"
            className={
              settings.textSize === 'normal' ? 'settings__option is-active' : 'settings__option'
            }
            onClick={() => update({ textSize: 'normal' })}
            aria-pressed={settings.textSize === 'normal'}
          >
            Звичайний
          </button>
          <button
            type="button"
            className={
              settings.textSize === 'large' ? 'settings__option is-active' : 'settings__option'
            }
            onClick={() => update({ textSize: 'large' })}
            aria-pressed={settings.textSize === 'large'}
          >
            Великий
          </button>
        </div>
      </div>

      <div className="settings__row">
        <div>
          <h2>Без анімацій</h2>
          <p>Вимикає рух і переходи в інтерфейсі — незалежно від налаштувань пристрою.</p>
        </div>
        <button
          type="button"
          className={settings.reducedMotion ? 'settings__toggle is-on' : 'settings__toggle'}
          onClick={() => update({ reducedMotion: !settings.reducedMotion })}
          aria-pressed={settings.reducedMotion}
        >
          {settings.reducedMotion ? 'Увімкнено' : 'Вимкнено'}
        </button>
      </div>
    </section>
  )
}

export default Settings
