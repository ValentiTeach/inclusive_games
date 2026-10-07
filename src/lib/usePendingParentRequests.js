import { useEffect, useState } from 'react'
import { countPendingParentRequests } from './admin'

/** Подія, яку адмін-панель шле після рішення: шапка перераховує лічильник. */
export const PARENT_REQUESTS_CHANGED = 'inclusive-games:parent-requests-changed'

export function announceParentRequestsChanged() {
  window.dispatchEvent(new Event(PARENT_REQUESTS_CHANGED))
}

/**
 * Скільки заявок батьків чекає рішення. Лише для модератора: іншим запит не
 * потрібен, і шапка не має ходити в базу заради числа, якого вони не побачать.
 */
export function usePendingParentRequests(enabled) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    function refresh() {
      countPendingParentRequests()
        .then((value) => {
          if (!cancelled) setCount(value)
        })
        .catch(() => {})
    }

    refresh()
    window.addEventListener(PARENT_REQUESTS_CHANGED, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(PARENT_REQUESTS_CHANGED, refresh)
    }
  }, [enabled])

  return enabled ? count : 0
}
