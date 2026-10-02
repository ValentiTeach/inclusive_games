import { useSyncExternalStore } from 'react'
import { supabase, isCloudConfigured } from './supabaseClient'
import { isMissingTable } from './assignments'

/**
 * Профіль адаптацій дитини — те, що задає фахівець.
 *
 * Окремо від налаштувань (lib/settings), які дитина змінює сама: тут речі, які
 * мають діяти завжди, на кожному пристрої дитини, і які дитина не мусить (і
 * часто не може) знайти й увімкнути. Тому профіль живе в хмарі, а в браузері
 * лежить лише його копія для роботи без мережі.
 *
 * Діагнозу тут немає і не буде. Колонка «для кого» — це підказка фахівцю у
 * формі, а в базу йдуть лише самі перемикачі. «Без обмеження часу» не каже,
 * чому, — і так і має бути: дані про здоров'я дитини, яких не зберігали, не
 * можуть і витекти.
 */

export const HOLD_RANGE = { min: 300, max: 800, step: 100, default: 500 }
export const REPEAT_RANGE = { min: 200, max: 1500, step: 100, default: 600 }
export const SCAN_RANGE = { min: 800, max: 3000, step: 100, default: 1500 }
export const SHORT_RANGE = { min: 5, max: 8, step: 1, default: 6 }

/**
 * Порядок і тексти рядків форми. `kind: 'ms' | 'count'` — у перемикача є
 * величина, яку фахівець підбирає під дитину.
 */
export const ADAPTATIONS = [
  {
    id: 'noTimeLimit',
    label: 'Без обмеження часу',
    detail: 'Бал лише за точність; там, де гра показує або чекає, — довше.',
    forWhom: 'ДЦП, ЗПР, повільний темп',
  },
  {
    id: 'largeTargets',
    label: 'Збільшені цілі, більші відступи',
    detail: 'Кнопки в іграх щонайменше 64 px, між ними ширші проміжки.',
    forWhom: 'моторні порушення, мала рука',
  },
  {
    id: 'holdMs',
    label: 'Затримка активації',
    detail: 'Кнопка спрацьовує, лише якщо її втримати. Випадковий дотик не рахується.',
    forWhom: 'тремор, гіперкінези',
    kind: 'ms',
    range: HOLD_RANGE,
  },
  {
    id: 'repeatGuardMs',
    label: 'Ігнорувати повторне натискання',
    detail: 'Друге натискання протягом цього часу не рахується.',
    forWhom: 'тремор, імпульсивні подвійні натискання',
    kind: 'ms',
    range: REPEAT_RANGE,
  },
  {
    id: 'scanMs',
    label: 'Керування однією кнопкою',
    detail: 'Варіанти підсвічуються по черзі; Пробіл, Enter або велика кнопка вибирає підсвічений.',
    forWhom: 'важкі моторні порушення',
    kind: 'ms',
    range: SCAN_RANGE,
  },
  {
    id: 'colorSafe',
    label: 'Палітра без червоно-зеленої пари',
    detail: 'Кольори, які розрізняють і при порушеннях кольорового зору, і форма як друга ознака.',
    forWhom: 'порушення кольорового зору',
  },
  {
    id: 'dyslexiaFont',
    label: 'Шрифт для дислексії',
    detail: 'Шрифт Andika з чіткими літерами, ширші інтервали між літерами, словами й рядками.',
    forWhom: 'дислексія',
  },
  {
    id: 'sensorySafe',
    label: 'Сенсорно-безпечний режим',
    detail: 'Без конфеті й анімацій, без раптових звуків, м’які кольори, м’яка реакція на помилку.',
    forWhom: 'РАС, сенсорна чутливість',
  },
  {
    id: 'shortTrials',
    label: 'Коротші спроби',
    detail: 'Не більше стількох проб або раундів у грі.',
    forWhom: 'швидка втомлюваність, мала тривалість уваги',
    kind: 'count',
    range: SHORT_RANGE,
  },
]

export const EMPTY_PROFILE = Object.freeze({
  noTimeLimit: false,
  largeTargets: false,
  holdMs: 0,
  repeatGuardMs: 0,
  scanMs: 0,
  colorSafe: false,
  dyslexiaFont: false,
  sensorySafe: false,
  shortTrials: 0,
})

function clampOrOff(value, range) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.min(range.max, Math.max(range.min, Math.round(number)))
}

/**
 * Профіль із бази чи з localStorage — це дані ззовні. Невідомі ключі
 * відкидаються, числа заганяються в межі: 50 000 мс утримання зробило б гру
 * неграбельною, а «true» рядком — не те саме, що true.
 */
export function normalizeAdaptations(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    noTimeLimit: source.noTimeLimit === true,
    largeTargets: source.largeTargets === true,
    holdMs: clampOrOff(source.holdMs, HOLD_RANGE),
    repeatGuardMs: clampOrOff(source.repeatGuardMs, REPEAT_RANGE),
    scanMs: clampOrOff(source.scanMs, SCAN_RANGE),
    colorSafe: source.colorSafe === true,
    dyslexiaFont: source.dyslexiaFont === true,
    sensorySafe: source.sensorySafe === true,
    shortTrials: clampOrOff(source.shortTrials, SHORT_RANGE),
  }
}

export function isActive(profile, id) {
  const value = profile?.[id]
  return value === true || (Number.isFinite(value) && value > 0)
}

export function activeAdaptations(profile) {
  return ADAPTATIONS.filter((item) => isActive(profile, item.id))
}

/** Короткий опис увімкненого — для списку учнів і для сторінки налаштувань. */
export function describeAdaptation(item, profile) {
  const value = profile[item.id]
  if (item.kind === 'ms') return `${item.label}: ${value} мс`
  if (item.kind === 'count') return `${item.label}: до ${value}`
  return item.label
}

/* ───────────────────── Активний профіль у цьому браузері ─────────────────────
 *
 * Копія лежить у localStorage разом з ідентифікатором власника. Причина та
 * сама, що й у локальної історії: комп'ютер у класі спільний, і друга дитина не
 * має отримати чужу затримку активації чи чужий шрифт.
 */
const CACHE_KEY = 'inclusive-games:adaptations'

let current = { owner: null, profile: { ...EMPTY_PROFILE } }
const listeners = new Set()

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { owner: parsed.owner ?? null, profile: normalizeAdaptations(parsed.profile) }
  } catch {
    return null
  }
}

function writeCache(value) {
  try {
    if (value.owner) localStorage.setItem(CACHE_KEY, JSON.stringify(value))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // Без копії профіль просто прийде з мережі наступного разу.
  }
}

function emit() {
  applyAdaptations(current.profile)
  listeners.forEach((listener) => listener())
}

export function getActiveAdaptations() {
  return current.profile
}

/**
 * Хто ввійшов. Профіль із копії застосовується лише тоді, коли копія належить
 * саме цій людині; чужа копія зникає одразу, ще до відповіді мережі.
 */
export function bindAdaptationsOwner(userId) {
  const cached = readCache()
  if (userId && cached?.owner === userId) {
    current = cached
  } else {
    current = { owner: userId ?? null, profile: { ...EMPTY_PROFILE } }
    if (cached && cached.owner !== userId) writeCache({ owner: null })
  }
  emit()
}

export function setActiveAdaptations(userId, profile) {
  current = { owner: userId ?? null, profile: normalizeAdaptations(profile) }
  writeCache(current)
  emit()
}

export function clearActiveAdaptations() {
  current = { owner: null, profile: { ...EMPTY_PROFILE } }
  writeCache(current)
  emit()
}

/** Для тестів: підставити профіль, не торкаючись сховища. */
export function __setAdaptationsForTest(profile) {
  current = { owner: 'test', profile: normalizeAdaptations(profile) }
  emit()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAdaptations() {
  return useSyncExternalStore(subscribe, getActiveAdaptations, getActiveAdaptations)
}

/**
 * Те, що робиться стилями, вішається на корінь документа: шрифт, палітра,
 * сенсорний режим і великі цілі мають діяти однаково в кожній грі, і жодна
 * гра не мусить про них знати.
 */
export function applyAdaptations(profile) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const flag = (name, on) => {
    if (on) root.dataset[name] = 'on'
    else delete root.dataset[name]
  }
  flag('colorSafe', profile.colorSafe)
  flag('dyslexiaFont', profile.dyslexiaFont)
  flag('sensorySafe', profile.sensorySafe)
  flag('largeTargets', profile.largeTargets)
}

/* ───────────────────────────── Хмара ───────────────────────────── */

const COLUMNS = 'student_id, settings, updated_at'

/** Профіль дитини, яка зараз увійшла. Мовчки: без мережі діє копія. */
export async function loadMyAdaptations(userId) {
  if (!isCloudConfigured || !userId) return
  const { data, error } = await supabase
    .from('student_adaptations')
    .select(COLUMNS)
    .eq('student_id', userId)
    .maybeSingle()

  if (error) return
  setActiveAdaptations(userId, data?.settings ?? EMPTY_PROFILE)
}

/** Профілі кількох учнів — для списку групи. null: таблиці ще немає. */
export async function listStudentAdaptations(studentIds) {
  if (studentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('student_adaptations')
    .select(COLUMNS)
    .in('student_id', studentIds)

  if (isMissingTable(error)) return null
  if (error) throw error
  return Object.fromEntries(
    (data ?? []).map((row) => [row.student_id, normalizeAdaptations(row.settings)]),
  )
}

export async function saveStudentAdaptations(studentId, profile) {
  const settings = normalizeAdaptations(profile)
  const { error } = await supabase
    .from('student_adaptations')
    .upsert({ student_id: studentId, settings }, { onConflict: 'student_id' })
  if (error) throw error
  return settings
}
