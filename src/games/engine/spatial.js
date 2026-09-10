/**
 * Навігація стрілками по фігурах, розкиданих на площині.
 *
 * Порядок у DOM тут нічого не означає: у Пошуку цілі фігури перемішані, тож
 * «наступна за Tab» лежить у випадковому місці екрана. Стрілка має вести до
 * найближчої фігури **в тому напрямку**, куди вона показує.
 *
 * Кандидати відсіюються конусом ±45° від напрямку, а серед тих, що лишились,
 * виграє найменше `along + 2 * perp`, а не просто найближчий. Подвійна вага
 * бічного зсуву означає «прямо попереду краще, ніж трохи ближче, але вбік» —
 * саме цього чекають від стрілки. Точні нічиї розв'язуються меншим індексом,
 * щоб рух був відтворюваним.
 */

const DIRECTIONS = {
  right: (dx, dy) => ({ along: dx, perp: Math.abs(dy) }),
  left: (dx, dy) => ({ along: -dx, perp: Math.abs(dy) }),
  down: (dx, dy) => ({ along: dy, perp: Math.abs(dx) }),
  up: (dx, dy) => ({ along: -dy, perp: Math.abs(dx) }),
}

/**
 * @param points  [{ x, y }] у відсотках поля
 * @param aspect  ширина поля / висота. Кут треба міряти таким, яким його бачить
 *   дитина, а не таким, яким він виходить у відсотках: на полі 4:3 точка на
 *   dx=50%, dy=50% лежить рівно на діагоналі у відсотках, але фізично це 240 px
 *   убік проти 180 px униз — тобто вона більше збоку, ніж знизу, і стрілка вниз
 *   вести туди не повинна. На розкладках цієї гри поправка міняє належність до
 *   конуса приблизно для 2–3% пар.
 * @returns індекс наступної точки; якщо в цьому напрямку нікого немає —
 *   повертає `fromIndex`, тобто курсор лишається на місці.
 */
export function nearestInDirection(points, fromIndex, direction, { aspect = 1 } = {}) {
  const from = points?.[fromIndex]
  const project = DIRECTIONS[direction]
  if (!from || !project) return fromIndex

  let best = fromIndex
  let bestScore = Infinity

  for (let index = 0; index < points.length; index++) {
    if (index === fromIndex) continue

    const point = points[index]
    const { along, perp } = project((point.x - from.x) * aspect, point.y - from.y)

    // Позаду або поза конусом ±45°.
    if (along <= 0 || perp > along) continue

    const score = along + perp * 2
    if (score < bestScore) {
      best = index
      bestScore = score
    }
  }

  return best
}
