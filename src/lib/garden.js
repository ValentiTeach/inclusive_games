/**
 * Сад — жетони замість рекордів.
 *
 * Нагорода йде за участь і зусилля, а не за результат: кожне завершене
 * заняття садить квітку, кожен день, коли дитина тренувалась, — травинку чи
 * пагін. Бал на сад не впливає ніяк: найгірша гра дня садить рівно те саме,
 * що й найкраща. Сад нічого не забирає й не в'яне — дитина, яка тиждень
 * хворіла, повертається до того самого саду.
 *
 * Сад рахується з того, що вже є (дні гри, проходження занять), а не
 * зберігається окремо: інакше він міг би розійтися з тим, що дитина справді
 * робила.
 */

export const GARDEN_SIZE = 24

const SESSION_PLANTS = ['tulip', 'sunflower', 'tree', 'butterfly', 'daisy', 'bee', 'mushroom', 'rose']
const DAY_PLANTS = ['sprout', 'grass', 'clover']

/**
 * @param days        дні гри ('YYYY-MM-DD', можна з повторами)
 * @param sessionDates дати завершених занять (ISO)
 * @returns { items, total, gardensDone } — items: поточний сад, від старших
 */
export function buildGarden({ days = [], sessionDates = [] }) {
  const events = [
    // День гри — на його початок: заняття того самого дня росте після травинки.
    ...[...new Set(days)].map((day) => ({ at: `${day}T00:00:00`, kind: 'day' })),
    ...sessionDates.map((at) => ({ at, kind: 'session' })),
  ]
    .map((event) => ({ ...event, time: new Date(event.at).getTime() }))
    .sort((a, b) => a.time - b.time || (a.kind === 'day' ? -1 : 1))

  let sessionIndex = 0
  let dayIndex = 0
  const all = events.map((event, index) => {
    const plant =
      event.kind === 'session'
        ? SESSION_PLANTS[sessionIndex++ % SESSION_PLANTS.length]
        : DAY_PLANTS[dayIndex++ % DAY_PLANTS.length]
    return { id: index, plant, kind: event.kind, at: event.at }
  })

  const gardensDone = Math.floor(Math.max(0, all.length - 1) / GARDEN_SIZE)
  const items = all.slice(gardensDone * GARDEN_SIZE).map((item, index) => ({ ...item, slot: index }))
  return { items, total: all.length, gardensDone }
}

/*
 * Місце в саду — детерміноване від номера, щоб сад не перемішувався при кожному
 * відкритті: дитина пам'ятає, де росте її соняшник.
 */
export function slotPosition(slot) {
  const cols = 8
  const row = Math.floor(slot / cols)
  const col = slot % cols
  const jitter = ((slot * 37) % 11) - 5
  return { x: 22 + col * 45 + (row % 2 ? 18 : 0) + jitter, y: 120 + row * 26 }
}

const PLANT_NAMES = {
  tulip: 'тюльпан',
  sunflower: 'соняшник',
  tree: 'деревце',
  butterfly: 'метелик',
  daisy: 'ромашка',
  bee: 'бджілка',
  mushroom: 'грибок',
  rose: 'троянда',
  clover: 'конюшина',
  grass: 'травичка',
  sprout: 'пагінець',
}

export function plantName(plant) {
  return PLANT_NAMES[plant] ?? 'рослинка'
}
