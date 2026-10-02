import { GAMES } from './games'

/**
 * Кроки заняття і бібліотека готових шаблонів.
 *
 * Крок — це простий об'єкт, який лягає в базу як є (session_plans.steps):
 *
 *   { kind: 'greeting' }                    привітання + «який у тебе настрій?»
 *   { kind: 'breathing', seconds: 30 }      дихальна вправа
 *   { kind: 'game', gameId, levelId? }      гра; рівень необов'язковий
 *   { kind: 'movement', seconds: 40 }       фізхвилинка «повтори за Совеням», без балу
 *   { kind: 'reflection' }                  «як тобі було?» + настрій після
 *
 * Бібліотека живе в коді, а не в базі: вона однакова для всіх, і вчитель, який
 * узяв шаблон, отримує його копію — правити бібліотеку йому не треба.
 */

export const STEP_KINDS = {
  greeting: { label: 'Привітання і настрій', short: 'Привіт', scored: false },
  breathing: { label: 'Дихальна вправа', short: 'Дихаємо', scored: false },
  game: { label: 'Гра', short: 'Гра', scored: true },
  movement: { label: 'Фізхвилинка', short: 'Рухаємось', scored: false },
  reflection: { label: 'Рефлексія і настрій після', short: 'Як було?', scored: false },
}

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

export function stepTitle(step) {
  if (step.kind === 'game') return GAME_TITLES[step.gameId] ?? step.gameId
  return STEP_KINDS[step.kind]?.label ?? step.kind
}

/** Підпис для картки візуального розкладу — коротко, дитині. */
export function stepShortTitle(step) {
  if (step.kind === 'game') return GAME_TITLES[step.gameId] ?? 'Гра'
  return STEP_KINDS[step.kind]?.short ?? step.kind
}

const DEFAULT_LIMITS = { maxMinutes: 25, breakEveryMinutes: 10 }

export const TEMPLATE_LIBRARY = [
  {
    id: 'attention-1-2',
    title: 'Увага, 1–2 клас',
    about: 'Зоровий пошук, короткочасна пам’ять і закономірності в спокійному темпі.',
    ...DEFAULT_LIMITS,
    steps: [
      { kind: 'greeting' },
      { kind: 'breathing', seconds: 30 },
      { kind: 'game', gameId: 'schulte', levelId: 'small' },
      { kind: 'game', gameId: 'what-vanished', levelId: 'four' },
      { kind: 'movement', seconds: 40 },
      { kind: 'game', gameId: 'continue-row' },
      { kind: 'reflection' },
    ],
  },
  {
    id: 'pre-writing',
    title: 'Підготовка до письма',
    about: 'Просторова орієнтація на клітинках, ведення лінії й перший звук слова.',
    ...DEFAULT_LIMITS,
    steps: [
      { kind: 'greeting' },
      { kind: 'breathing', seconds: 30 },
      { kind: 'game', gameId: 'graphic-dictation', levelId: 'arrows' },
      { kind: 'game', gameId: 'trace-path', levelId: 'wide' },
      { kind: 'movement', seconds: 40 },
      { kind: 'game', gameId: 'first-sound', levelId: 'first' },
      { kind: 'reflection' },
    ],
  },
  {
    id: 'working-memory',
    title: 'Робоча пам’ять',
    about: 'Утримати й відтворити: цифри, послідовність кольорів, «що було раніше».',
    ...DEFAULT_LIMITS,
    steps: [
      { kind: 'greeting' },
      { kind: 'breathing', seconds: 30 },
      { kind: 'game', gameId: 'digit-span', levelId: 'forward' },
      { kind: 'game', gameId: 'simon', levelId: 'short' },
      { kind: 'movement', seconds: 40 },
      { kind: 'game', gameId: 'n-back', levelId: 'one-back' },
      { kind: 'reflection' },
    ],
  },
  {
    id: 'self-regulation',
    title: 'Саморегуляція',
    about: 'Зупинитися, дочекатися, переключитися — і двічі подихати.',
    ...DEFAULT_LIMITS,
    steps: [
      { kind: 'greeting' },
      { kind: 'breathing', seconds: 60 },
      { kind: 'game', gameId: 'day-night', levelId: 'inverse' },
      { kind: 'game', gameId: 'go-no-go', levelId: 'short' },
      { kind: 'movement', seconds: 40 },
      { kind: 'game', gameId: 'traffic-light', levelId: 'two' },
      { kind: 'breathing', seconds: 30 },
      { kind: 'reflection' },
    ],
  },
]

/**
 * Зріз «до/після»: коротка фіксована батарея приблизно на 10 хвилин.
 *
 * Рівні тут фіксовані назавжди. Змінити рівень у батареї — означає зробити всі
 * попередні зрізи непорівнянними з наступними, тож міняти їх можна лише разом
 * із назвою (`BATTERY_VERSION`), щоб звіт не ставив поруч різні батареї.
 * Адаптивні ігри для цього не годяться: у них змінюється сама проба.
 */
export const BATTERY_VERSION = 'v1'

export const BATTERY = {
  id: `battery-${BATTERY_VERSION}`,
  title: 'Зріз «до/після»',
  about:
    'Ті самі шість ігор на тих самих рівнях щоразу, приблизно 10 хвилин. Раз на 4–6 тижнів — тоді результати чесно порівнюються в часі.',
  maxMinutes: null,
  breakEveryMinutes: null,
  steps: [
    { kind: 'greeting' },
    { kind: 'game', gameId: 'reaction-time', levelId: 'classic' },
    { kind: 'game', gameId: 'schulte', levelId: 'classic' },
    { kind: 'game', gameId: 'go-no-go', levelId: 'classic' },
    { kind: 'game', gameId: 'digit-span', levelId: 'forward' },
    { kind: 'game', gameId: 'stroop', levelId: 'short' },
    { kind: 'game', gameId: 'what-vanished', levelId: 'six' },
    { kind: 'reflection' },
  ],
}

/** Скільки тижнів радять між зрізами. */
export const BATTERY_INTERVAL_WEEKS = { min: 4, max: 6 }

/** Новий порожній крок для конструктора. */
export function newStep(kind, gameId) {
  if (kind === 'breathing') return { kind, seconds: 30 }
  if (kind === 'movement') return { kind, seconds: 40 }
  if (kind === 'game') return { kind, gameId }
  return { kind }
}

const MAX_STEPS = 20

/**
 * Кроки з бази чи з форми — нормалізуються однаково: невідомий тип кроку
 * викидається, секунди заганяються в межі, гра має існувати. Заняття з
 * кроком, якого клієнт не вміє показати, інакше зламалося б посеред уроку.
 */
export function normalizeSteps(steps, knownGames = GAME_TITLES) {
  if (!Array.isArray(steps)) return []
  return steps
    .filter((step) => step && STEP_KINDS[step.kind])
    .filter((step) => step.kind !== 'game' || knownGames[step.gameId])
    .slice(0, MAX_STEPS)
    .map((step) => {
      if (step.kind === 'breathing' || step.kind === 'movement') {
        const fallback = step.kind === 'breathing' ? 30 : 40
        const seconds = Number(step.seconds)
        return {
          kind: step.kind,
          seconds: Number.isFinite(seconds) ? Math.min(180, Math.max(10, Math.round(seconds))) : fallback,
        }
      }
      if (step.kind === 'game') {
        return step.levelId
          ? { kind: 'game', gameId: step.gameId, levelId: String(step.levelId) }
          : { kind: 'game', gameId: step.gameId }
      }
      return { kind: step.kind }
    })
}
