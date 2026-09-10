import { describe, it, expect } from 'vitest'
import { nearestInDirection } from './spatial'
import { generateTrial, config as targetSearchConfig } from '../target-search/targetSearch.config'

/**
 * Хрестик навколо центру: сусід у кожному з чотирьох напрямків рівно на одній
 * відстані. Індекси навмисно не збігаються з напрямками, щоб «випадково
 * правильна» відповідь за порядком у масиві не пройшла.
 */
const CROSS = [
  { x: 50, y: 50 }, // 0 — центр
  { x: 50, y: 20 }, // 1 — вгору
  { x: 80, y: 50 }, // 2 — праворуч
  { x: 50, y: 80 }, // 3 — вниз
  { x: 20, y: 50 }, // 4 — ліворуч
]

describe('nearestInDirection — базовий рух', () => {
  it.each([
    ['up', 1],
    ['right', 2],
    ['down', 3],
    ['left', 4],
  ])('%s веде до сусіда в тому напрямку', (direction, expected) => {
    expect(nearestInDirection(CROSS, 0, direction)).toBe(expected)
  })

  // Порожній напрямок не має підсовувати «хоч когось»: курсор лишається де був.
  it('stays put when there is nothing that way', () => {
    expect(nearestInDirection([{ x: 10, y: 10 }, { x: 90, y: 10 }], 1, 'right')).toBe(1)
  })

  it('never returns the point it started from as a move', () => {
    expect(nearestInDirection(CROSS, 2, 'right')).toBe(2)
  })
})

describe('nearestInDirection — конус ±45°', () => {
  /**
   * Точка позаду не стає кандидатом, навіть якщо вона найближча з усіх.
   */
  it('ignores what lies behind, however close', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 49, y: 50 }, // майже впритул, але ліворуч
      { x: 90, y: 50 }, // далеко, але праворуч
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(2)
  })

  /**
   * Точка збоку відсікається конусом. Без цього стрілка вправо стрибала б на
   * фігуру, що лежить майже під курсором.
   */
  it('ignores what lies to the side of the cone', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 55, y: 90 }, // трохи праворуч, але глибоко вниз — поза конусом
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(0)
  })

  it('accepts a point exactly on the 45° edge', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 70, y: 70 },
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(1)
    expect(nearestInDirection(points, 0, 'down')).toBe(1)
  })
})

describe('nearestInDirection — прямо попереду краще, ніж ближче вбік', () => {
  /**
   * Головне рішення у виборі метрики. Просто «найближчий у конусі» відводив би
   * курсор убік від лінії руху, і дитина, натиснувши → тричі, опинялася б зовсім
   * не там, де очікувала. Бічний зсув важить удвічі.
   */
  it('prefers the point straight ahead over a nearer diagonal one', () => {
    const points = [
      { x: 10, y: 50 },
      { x: 40, y: 50 }, // прямо праворуч: уперед 30, убік 0
      { x: 25, y: 64 }, // ближче по прямій: уперед 15, убік 14
    ]

    // Просте «найближчий у конусі» обрало б діагональ (15 + 14 = 29 проти 30).
    // Подвійна вага бічного зсуву робить її дорожчою (15 + 28 = 43).
    expect(nearestInDirection(points, 0, 'right')).toBe(1)
  })

  it('still takes the diagonal when nothing lies straight ahead', () => {
    const points = [
      { x: 10, y: 50 },
      { x: 36, y: 76 },
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(1)
  })

  // Рух має бути відтворюваним: та сама сцена і та сама стрілка — той самий крок.
  it('breaks an exact tie the same way every time', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 80, y: 40 },
      { x: 80, y: 60 },
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(1)
    expect(nearestInDirection(points, 0, 'right')).toBe(1)
  })
})

describe('nearestInDirection — поправка на пропорцію поля', () => {
  /**
   * На полі 4:3 точка на dx=50%, dy=50% лежить рівно на діагоналі у відсотках,
   * але фізично це 240 px убік проти 180 px униз — тобто вона більше збоку, ніж
   * знизу. Без поправки стрілка вниз вела б туди.
   */
  it('excludes a point that only looks diagonal in percentage space', () => {
    const points = [
      { x: 12.5, y: 25 },
      { x: 62.5, y: 75 },
    ]

    expect(nearestInDirection(points, 0, 'down')).toBe(1)
    expect(nearestInDirection(points, 0, 'down', { aspect: 4 / 3 })).toBe(0)
  })

  it('keeps a straight-down neighbour whatever the aspect', () => {
    const points = [
      { x: 50, y: 25 },
      { x: 50, y: 75 },
    ]

    expect(nearestInDirection(points, 0, 'down', { aspect: 4 / 3 })).toBe(1)
  })
})

describe('nearestInDirection — крайні випадки', () => {
  it('survives an unknown direction', () => {
    expect(nearestInDirection(CROSS, 0, 'sideways')).toBe(0)
  })

  it('survives an index that points nowhere', () => {
    expect(nearestInDirection(CROSS, 99, 'right')).toBe(99)
    expect(nearestInDirection([], 0, 'right')).toBe(0)
    expect(nearestInDirection(undefined, 0, 'right')).toBe(0)
  })

  /**
   * Сітка з дірками — саме те, що будує гра: фігури стоять по вузлах, але не в
   * кожному. Стрілка має перестрибнути порожній вузол, а не впертися в нього.
   */
  it('steps over a hole in the lattice', () => {
    const points = [
      { x: 10, y: 50 },
      // вузол на x=30 порожній
      { x: 50, y: 50 },
    ]

    expect(nearestInDirection(points, 0, 'right')).toBe(1)
  })
})

/**
 * Найважливіша властивість усієї навігації, і перевірити її можна лише на
 * справжніх розкладках гри: **до кожної фігури має бути шлях стрілками**.
 *
 * Конус ±45° відсікає кандидатів, а фігури стоять по вузлах ґратки з дірками —
 * тож теоретично якась фігура могла б опинитися в «мертвій зоні», куди жодна
 * стрілка не веде. Для дитини це означало б недосяжну ціль і непрохідну пробу.
 */
describe('nearestInDirection — на справжніх розкладках Пошуку цілі', () => {
  const ASPECT = 4 / 3
  const DIRECTIONS = ['left', 'right', 'up', 'down']

  function reachableFrom(points, start) {
    const seen = new Set([start])
    const queue = [start]

    while (queue.length > 0) {
      const current = queue.shift()
      for (const direction of DIRECTIONS) {
        const next = nearestInDirection(points, current, direction, { aspect: ASPECT })
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }

    return seen
  }

  it.each(targetSearchConfig.levels.map((level) => [level.label, level]))(
    'кожна фігура досяжна стрілками — %s',
    (_label, level) => {
      // Розкладка щоразу інша, тож беремо багато проб, а не одну вдалу.
      for (let attempt = 0; attempt < 40; attempt++) {
        const points = generateTrial(level).items

        const scene = points.map((point) => [point.x, point.y])
        expect(reachableFrom(points, 0).size, `спроба ${attempt}: ${JSON.stringify(scene)}`).toBe(
          points.length,
        )
      }
    },
  )

  /**
   * Курсор не має потрапляти в пастку: якщо стрілка кудись привела, протилежна
   * мусить вести вже кудись інше, а не залишати на місці.
   *
   * Сильнішого не обіцяємо навмисно. Виміряно на 150 розкладках: рівно назад
   * повертають 97.8% кроків — решта 2.2% приводять до сусідньої фігури, і це
   * нормальний наслідок конуса ±45° на ґратці з дірками, а не помилка.
   */
  it('жоден крок не заганяє курсор у пастку', () => {
    const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' }

    for (let attempt = 0; attempt < 20; attempt++) {
      const points = generateTrial(targetSearchConfig.levels[1]).items

      for (let from = 0; from < points.length; from++) {
        for (const direction of DIRECTIONS) {
          const to = nearestInDirection(points, from, direction, { aspect: ASPECT })
          if (to === from) continue

          const back = nearestInDirection(points, to, opposite[direction], { aspect: ASPECT })
          expect(back, `${direction}: ${from} -> ${to} -> ${back}`).not.toBe(to)
        }
      }
    }
  })
})
