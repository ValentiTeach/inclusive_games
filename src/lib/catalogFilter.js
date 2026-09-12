import { CATEGORIES } from '../data/games'

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
