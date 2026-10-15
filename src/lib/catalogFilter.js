import { CATEGORIES, NEEDS, gameNeeds } from '../data/games'

/**
 * Фільтр каталогу живе в адресі, а не в стані компонента. Так посилання на
 * «ігри для пам'яті» можна дати колезі або лишити в закладках, а кнопка «назад»
 * повертає до попереднього вибору, а не викидає з каталогу.
 */
export function categoryFromParams(params) {
  const value = params.get('category')
  // Чуже або застаріле значення в адресі — не привід показати порожній каталог.
  return value && Object.hasOwn(CATEGORIES, value) ? value : null
}

export function filterByCategory(games, category) {
  return category ? games.filter((game) => game.category === category) : games
}

/** Скільки ігор на кожен навик — щоб цифра у фільтрі не розходилася з тим,
 *  що відкриється після натискання. */
export function countByCategory(games) {
  const counts = {}
  for (const key of Object.keys(CATEGORIES)) counts[key] = 0
  for (const game of games) {
    if (game.category in counts) counts[game.category] += 1
  }
  return counts
}

/*
 * «Дитині важко: …» — вимоги, які треба сховати. Теж в адресі
 * (?without=hearing,reading), щоб добірку під дитину можна було зберегти чи
 * передати колезі. Невідомі ключі мовчки відкидаються.
 */
export function needsFromParams(params) {
  const raw = params.get('without') ?? ''
  return Object.keys(NEEDS).filter((key) => raw.split(',').includes(key))
}

export function filterByNeeds(games, without) {
  if (without.length === 0) return games
  return games.filter((game) => !gameNeeds(game.id).some((need) => without.includes(need)))
}

/** Адреса каталогу з обома фільтрами: навик і «без вимог». */
export function catalogHref({ category = null, without = [] } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (without.length > 0) params.set('without', without.join(','))
  const query = params.toString()
  return query ? `/games?${query}` : '/games'
}
