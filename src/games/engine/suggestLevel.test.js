import { describe, it, expect } from 'vitest'
import { suggestLevel } from './suggestLevel'
import { clampScore } from './score'

const config = {
  levels: [{ id: 'easy' }, { id: 'normal' }, { id: 'hard' }],
}

describe('suggestLevel', () => {
  it('starts a new player on the first level without calling it a suggestion', () => {
    expect(suggestLevel(config, [])).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })

  it('raises the level after a strong result', () => {
    const history = [{ levelId: 'easy', score: 90 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('lowers the level after a weak result', () => {
    const history = [{ levelId: 'hard', score: 30 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('keeps the level for a middling result', () => {
    const history = [{ levelId: 'normal', score: 60 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: false })
  })

  it('does not raise past the hardest level', () => {
    const history = [{ levelId: 'hard', score: 100 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'hard', isAutoSuggested: false })
  })

  it('does not lower below the easiest level', () => {
    const history = [{ levelId: 'easy', score: 0 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })

  it('reads only the most recent attempt', () => {
    // history[0] is the latest; older weak scores must not drag the level down.
    const history = [
      { levelId: 'easy', score: 90 },
      { levelId: 'easy', score: 10 },
      { levelId: 'easy', score: 5 },
    ]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'normal', isAutoSuggested: true })
  })

  it('falls back to the first level when the stored level no longer exists', () => {
    // Levels can be renamed between releases while old history still refers to
    // the previous id.
    const history = [{ levelId: 'removed-level', score: 60 }]
    expect(suggestLevel(config, history)).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })
})

describe('clampScore', () => {
  it('keeps scores inside 0..100', () => {
    expect(clampScore(-20)).toBe(0)
    expect(clampScore(150)).toBe(100)
    expect(clampScore(50)).toBe(50)
  })

  it('rounds fractional scores', () => {
    expect(clampScore(66.6)).toBe(67)
    expect(clampScore(66.4)).toBe(66)
  })
})

/*
 * Сусідні ігри навмисно мають іншу кількість рівнів, ніж config: саме через це
 * порівняння йде часткою, а не індексом, і тест має це ловити.
 */
const peerLevels = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }]

function peerAttempt(levelId, score, date) {
  return { levelId, score, date }
}

function peer(attempts) {
  return { levels: peerLevels, attempts }
}

describe('suggestLevel за спорідненими іграми', () => {
  it('не вигадує рівень з однієї-єдиної спроби в категорії', () => {
    const category = [peer([peerAttempt('p5', 100, '2026-09-10')])]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: false,
    })
  })

  it('ставить новачка в категорії на найлегший рівень', () => {
    expect(suggestLevel(config, [], [])).toEqual({ levelId: 'easy', isAutoSuggested: false })
  })

  it('впевненого в категорії не садить на найлегше', () => {
    const category = [
      peer([
        peerAttempt('p5', 100, '2026-09-10'),
        peerAttempt('p5', 95, '2026-09-09'),
        peerAttempt('p4', 90, '2026-09-08'),
      ]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'hard',
      isAutoSuggested: true,
    })
  })

  it('того, кому важко в категорії, лишає на найлегшому', () => {
    const category = [
      peer([peerAttempt('p1', 20, '2026-09-10'), peerAttempt('p2', 30, '2026-09-09')]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: true,
    })
  })

  it('середину категорії кладе на середній рівень', () => {
    const category = [
      peer([peerAttempt('p3', 70, '2026-09-10'), peerAttempt('p3', 65, '2026-09-09')]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'normal',
      isAutoSuggested: true,
    })
  })

  /**
   * Категорія — лише здогад, тож щойно в самій грі з'явився бодай один
   * результат, він має важити більше за сусідні ігри.
   */
  it('власна історія гри важливіша за категорію', () => {
    const own = [{ levelId: 'easy', score: 50, date: '2026-09-01' }]
    const category = [
      peer([peerAttempt('p5', 100, '2026-09-10'), peerAttempt('p5', 100, '2026-09-09')]),
    ]

    expect(suggestLevel(config, own, category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: false,
    })
  })

  /**
   * Дитина могла рік тому пройти категорію на найважчому, а відтоді довго не
   * грати й просісти. Вікно в п'ять спроб існує саме для того, щоб рівень
   * відповідав сьогоднішній дитині.
   */
  it('спирається на свіжі спроби, а не на давні перемоги', () => {
    const category = [
      peer([
        peerAttempt('p1', 30, '2026-09-10'),
        peerAttempt('p1', 30, '2026-09-09'),
        peerAttempt('p1', 30, '2026-09-08'),
        peerAttempt('p1', 30, '2026-09-07'),
        peerAttempt('p1', 30, '2026-09-06'),
        peerAttempt('p5', 100, '2026-01-01'),
        peerAttempt('p5', 100, '2026-01-02'),
      ]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: true,
    })
  })

  /**
   * Вікно в п'ять спроб рахується по всій категорії разом. Якби кожна гра
   * приносила свої п'ять, давні перемоги в одній грі перебивали б свіжі
   * труднощі в іншій — і дитина знову починала б із зависокого рівня.
   */
  it('збирає свіжість наскрізь по всіх іграх категорії, а не в кожній окремо', () => {
    const category = [
      peer([
        peerAttempt('p5', 100, '2026-01-01'),
        peerAttempt('p5', 100, '2026-01-02'),
        peerAttempt('p5', 100, '2026-01-03'),
      ]),
      peer([
        peerAttempt('p1', 20, '2026-09-10'),
        peerAttempt('p1', 20, '2026-09-09'),
        peerAttempt('p1', 20, '2026-09-08'),
        peerAttempt('p1', 20, '2026-09-07'),
        peerAttempt('p1', 20, '2026-09-06'),
      ]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: true,
    })
  })

  it('пропускає рівні, яких у тій грі вже немає', () => {
    const category = [
      peer([
        peerAttempt('знятий-рівень', 100, '2026-09-10'),
        peerAttempt('p3', 70, '2026-09-09'),
        peerAttempt('p3', 65, '2026-09-08'),
      ]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'normal',
      isAutoSuggested: true,
    })
  })

  it('не виходить за межі рівнів гри, коли в категорії все ідеально', () => {
    const category = [
      peer([peerAttempt('p5', 100, '2026-09-10'), peerAttempt('p5', 100, '2026-09-09')]),
    ]
    const twoLevels = { levels: [{ id: 'простий' }, { id: 'складний' }] }

    expect(suggestLevel(twoLevels, [], category)).toEqual({
      levelId: 'складний',
      isAutoSuggested: true,
    })
  })

  /**
   * Легко пройдений середній рівень означає, що дитина його вже переросла.
   * Без цього зсуву вона починала б нову гру там, де їй уже нецікаво.
   */
  it('легко пройдений рівень підіймає оцінку, а не лишає на місці', () => {
    const category = [
      peer([peerAttempt('p3', 100, '2026-09-10'), peerAttempt('p3', 100, '2026-09-09')]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'hard',
      isAutoSuggested: true,
    })
  })

  /**
   * Найважчий рівень, пройдений на сто, зсувається за межу шкали. Якщо цей
   * надлишок не обрізати, одна блискуча спроба перетягує середнє і дитина
   * дістає рівень, якого її решта спроб не підтверджує.
   */
  it('блискуча спроба на найважчому не перетягує середнє за шкалу', () => {
    const category = [
      peer([peerAttempt('p5', 100, '2026-09-10'), peerAttempt('p2', 50, '2026-09-09')]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'normal',
      isAutoSuggested: true,
    })
  })

  /**
   * Дзеркальний випадок: провал на найлегшому рівні гри з двома рівнями зсуває
   * частку нижче нуля. Без нижньої межі середнє дає від'ємний номер рівня — і
   * гра падає ще до першого екрана.
   */
  it('провал на найлегшому не дає від’ємного рівня', () => {
    const twoLevelPeer = {
      levels: [{ id: 'простий' }, { id: 'складний' }],
      attempts: [peerAttempt('простий', 10, '2026-09-10'), peerAttempt('простий', 10, '2026-09-09')],
    }

    expect(suggestLevel(config, [], [twoLevelPeer])).toEqual({
      levelId: 'easy',
      isAutoSuggested: true,
    })
  })

  /**
   * Знятий рівень — це відсутнє свідчення, а не свідчення про найлегший рівень.
   * Інакше кожна зміна складності гри заднім числом занижувала б дітей.
   */
  it('зняті рівні не тягнуть оцінку вниз', () => {
    const category = [
      peer([
        peerAttempt('знятий-рівень', 100, '2026-09-10'),
        peerAttempt('інший-знятий', 100, '2026-09-09'),
        peerAttempt('p5', 100, '2026-09-08'),
        peerAttempt('p5', 95, '2026-09-07'),
      ]),
    ]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'hard',
      isAutoSuggested: true,
    })
  })

  it('не ділить на нуль у грі з одним рівнем', () => {
    const category = [{ levels: [{ id: 'єдиний' }], attempts: [
      peerAttempt('єдиний', 100, '2026-09-10'),
      peerAttempt('єдиний', 100, '2026-09-09'),
    ] }]

    expect(suggestLevel(config, [], category)).toEqual({
      levelId: 'easy',
      isAutoSuggested: true,
    })
  })
})
