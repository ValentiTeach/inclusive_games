import { useMemo, useSyncExternalStore } from 'react'
import uk from './uk'
import en from './en'

/**
 * Мова інтерфейсу для дорослих.
 *
 * Українська — основна й повна. Англійська — для батьків з української
 * діаспори: шапка, головна, вхід, сторінка дитини, акаунт, відгук. Самі ігри
 * лишаються українською навмисно — дитина вчиться саме українською, — а
 * довідка й юридичні сторінки поки лише українською, і в англійському режимі
 * це сказано прямо.
 *
 * Без бібліотеки: словник «ключ → рядок» і підстановка {змінних}. Ключ, якого
 * немає в перекладі, показує українське — а не порожнє місце чи сам ключ; тест
 * стежить, щоб таких не було.
 *
 * Додати мову (кримськотатарську, наприклад): скопіювати en.js у qt.js,
 * перекласти носієм мови, додати рядок у LANGUAGES і DICTIONARIES.
 */

export const LANGUAGES = {
  uk: { label: 'Українська', htmlLang: 'uk' },
  en: { label: 'English', htmlLang: 'en' },
}

export const DICTIONARIES = { uk, en }

const STORAGE_KEY = 'inclusive-games:locale'
const listeners = new Set()

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return Object.hasOwn(DICTIONARIES, value ?? '') ? value : 'uk'
  } catch {
    return 'uk'
  }
}

let current = readStored()

export function getLocale() {
  return current
}

/** Атрибут lang — для читача екрана: англійський голос на українському тексті нечитабельний. */
export function applyLocale(locale = current) {
  try {
    document.documentElement.lang = LANGUAGES[locale].htmlLang
  } catch {
    // Без document (тести в Node) — нічого ставити.
  }
}

export function setLocale(locale) {
  if (!Object.hasOwn(DICTIONARIES, locale)) return
  current = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Приватне вікно: мова діятиме до кінця сеансу.
  }
  applyLocale(locale)
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function translate(locale, key, vars) {
  const template = DICTIONARIES[locale]?.[key] ?? uk[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : ''))
}

export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale, () => 'uk')
}

/** `const t = useT()` → `t('nav.games')`, `t('home.trust', { months: 12 })`. */
export function useT() {
  const locale = useLocale()
  return useMemo(
    () => Object.assign((key, vars) => translate(locale, key, vars), { locale }),
    [locale],
  )
}
