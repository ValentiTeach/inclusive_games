import { useState } from 'react'
import { FAVORITE_PLANTS, plantName } from '../../lib/garden'
import './GardenSettings.css'

const PLANT_EMOJI = {
  sunflower: '🌻',
  tulip: '🌷',
  rose: '🌹',
  daisy: '🌼',
  tree: '🌳',
  mushroom: '🍄',
}

/**
 * Назва саду й улюблена рослина. Своє — те, про що дитина піклується: сад з
 * ім'ям «Чарівний» і власним соняшником посередині — її сад, а не таблиця.
 */
function GardenSettings({ prefs, onChange }) {
  const [draft, setDraft] = useState(prefs.name)

  return (
    <div className="garden-settings">
      <form
        className="garden-settings__name"
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ ...prefs, name: draft })
        }}
      >
        <label htmlFor="garden-name">Як звати твій сад?</label>
        <div className="garden-settings__row">
          <input
            id="garden-name"
            value={draft}
            maxLength={40}
            placeholder="Чарівний сад"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">Назвати</button>
        </div>
      </form>

      <div className="garden-settings__favorite" role="group" aria-labelledby="garden-favorite-label">
        <p id="garden-favorite-label">Улюблена рослина — росте посередині разом із садом:</p>
        <div className="garden-settings__plants">
          {FAVORITE_PLANTS.map((plant) => (
            <button
              key={plant}
              type="button"
              aria-pressed={prefs.favorite === plant}
              aria-label={plantName(plant)}
              title={plantName(plant)}
              onClick={() => onChange({ ...prefs, favorite: plant })}
            >
              <span aria-hidden="true">{PLANT_EMOJI[plant]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GardenSettings
