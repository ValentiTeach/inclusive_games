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

      {/*
        Три режими, а не перемикач: для частини дітей тиша — умова, за якої
        вони взагалі можуть займатися, для інших порожній звуковий фон сам стає
        відволіканням. Одне «увімк./вимк.» не давало ні того, ні того.
      */}
      <div className="settings__row">
        <div>
          <h2>Звук</h2>
          <p>
            «Тихо» — жодного звуку. «Клацання» — короткі сигнали на кнопках і за
            відповіді. «Музика» — ще й рівний тихий фон, поки триває гра.
          </p>
        </div>
        <div className="settings__options">
          {[
            ['off', 'Тихо'],
            ['clicks', 'Клацання'],
            ['music', 'Музика'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                settings.sound === value ? 'settings__option is-active' : 'settings__option'
              }
              onClick={() => update({ sound: value })}
              aria-pressed={settings.sound === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings__row">
        <div>
          <h2>Тема</h2>
          <p>«Системна» повторює налаштування твого пристрою.</p>
        </div>
        <div className="settings__options">
          {[
            ['system', 'Системна'],
            ['light', 'Світла'],
            ['dark', 'Темна'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={settings.theme === value ? 'settings__option is-active' : 'settings__option'}
              onClick={() => update({ theme: value })}
              aria-pressed={settings.theme === value}
            >
              {label}
            </button>
          ))}
        </div>
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
