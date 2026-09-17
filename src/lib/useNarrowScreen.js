import { useCallback, useSyncExternalStore } from 'react'

/**
 * Чи екран надто вузький для розкладки в дванадцять клавіш.
 *
 * Межа не кругле число, а та ширина, нижче якої справжня розкладка дає менш ніж
 * 38 px на клавішу: дванадцять клавіш, одинадцять проміжків і поля разом
 * вимагають близько 480 px. Вище цієї межі справжня розкладка ще зручна, і
 * міняти її нема причини.
 */
export const NARROW_QUERY = '(max-width: 480px)'

/*
 * useSyncExternalStore, а не useEffect із setState: ширина екрана — це
 * зовнішній стан, який React має читати, а не копію, яку треба доганяти.
 * Копія розходилася б у ту мить, коли екран змінився між першим малюванням і
 * підпискою, — а поворот телефона робить саме це.
 */
export function useNarrowScreen(query = NARROW_QUERY) {
  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia?.(query)
      if (!media) return () => {}

      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    try {
      return Boolean(window.matchMedia?.(query).matches)
    } catch {
      // Середовище без matchMedia: широкий екран — безпечніше припущення, бо
      // справжня розкладка лишається тією, якої навчають.
      return false
    }
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
