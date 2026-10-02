import { useState } from 'react'
import { getSettings, saveSettings, applySettings } from '../lib/settings'
import { isSpeechSupported, speak, useUkrainianVoice } from '../lib/speech'
import { activeAdaptations, describeAdaptation, useAdaptations } from '../lib/adaptations'
import Helper from '../components/ui/Helper'
import './Settings.css'

function Settings() {
  const [settings, setSettings] = useState(() => getSettings())
  const voice = useUkrainianVoice()
  const adaptations = useAdaptations()
  const fromSpecialist = activeAdaptations(adaptations)

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
        Профіль від фахівця показується, а не редагується: дитина має знати,
        чому, скажімо, кнопку треба тримати, — але вимкнути це сама не може.
        Він діє на всіх її пристроях, бо лежить у хмарі.
      */}
      {fromSpecialist.length > 0 && (
        <div className="settings__row settings__row--stacked settings__specialist">
          <div>
            <h2>Налаштував фахівець</h2>
            <p>
              Діє на всіх твоїх пристроях. Змінити це може лише вчитель або
              фахівець, який із тобою займається.
            </p>
            <ul className="settings__specialist-list">
              {fromSpecialist.map((item) => (
                <li key={item.id}>{describeAdaptation(item, adaptations)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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

      {/*
        Окремо від звуку: «Тихо» знімає сигнали й музику, але дитині, яка не
        читає, голос інструкції потрібен і в тиші.
      */}
      <div className="settings__row settings__row--stacked">
        <div>
          <h2>Озвучення інструкцій</h2>
          <p>
            Голос пристрою читає опис гри і підказки пробної гри. «Автоматично» —
            читає сам, щойно відкрито гру; «На кнопку» — лише після «Послухати».
          </p>
          {voice ? (
            <button
              type="button"
              className="settings__option settings__voice-test"
              onClick={() => speak('Привіт! Так звучатимуть інструкції до ігор.')}
            >
              Перевірити голос
            </button>
          ) : (
            <p className="settings__voice-missing" role="status">
              {isSpeechSupported()
                ? 'На цьому пристрої немає українського голосу, тож озвучення не працюватиме. Його можна додати в налаштуваннях системи: Windows — «Час і мова → Мовлення», Android — «Синтез мовлення» (Google), iPhone і iPad — «Універсальний доступ → Усний контент → Голоси».'
                : 'Цей браузер не вміє озвучувати текст.'}
            </p>
          )}
        </div>
        <div className="settings__options">
          {[
            ['off', 'Не озвучувати'],
            ['button', 'На кнопку'],
            ['auto', 'Автоматично'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                settings.voice === value ? 'settings__option is-active' : 'settings__option'
              }
              onClick={() => update({ voice: value })}
              aria-pressed={settings.voice === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/*
        Для дитини з повільним темпом чи моторними труднощами звичайний таймер
        міряє руку, а не увагу. Те саме перемикається й просто перед грою.
      */}
      <div className="settings__row">
        <div>
          <h2>Темп ігор</h2>
          <p>
            «Без поспіху» — довше показ і ширше вікно для відповіді, а бал не
            знижується за час. Такі спроби позначаються у звіті вчителя.
          </p>
        </div>
        <div className="settings__options">
          {[
            ['normal', 'Звичайний темп'],
            ['relaxed', 'Без поспіху'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                settings.pace === value ? 'settings__option is-active' : 'settings__option'
              }
              onClick={() => update({ pace: value })}
              aria-pressed={settings.pace === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/*
        Червоний хрестик і зумер для тривожної дитини читаються як покарання.
        М'який варіант каже те саме — «не те» — без страху.
      */}
      <div className="settings__row">
        <div>
          <h2>Коли помиляюсь</h2>
          <p>
            «Звичайно» — колір помилки й короткий сигнал. «М’яко» — спокійний
            колір, тихий звук і Совеня каже «Спробуй ще».
            {adaptations.sensorySafe && ' Зараз увімкнено фахівцем — завжди м’яко.'}
          </p>
        </div>
        <div className="settings__options">
          <Helper pose="calm" size={40} />
          {[
            ['standard', 'Звичайно'],
            ['gentle', 'М’яко'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                (adaptations.sensorySafe ? 'gentle' : settings.errorFeedback) === value
                  ? 'settings__option is-active'
                  : 'settings__option'
              }
              onClick={() => update({ errorFeedback: value })}
              aria-pressed={(adaptations.sensorySafe ? 'gentle' : settings.errorFeedback) === value}
              disabled={adaptations.sensorySafe}
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
