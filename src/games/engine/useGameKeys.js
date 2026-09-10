import { useEffect, useLayoutEffect, useRef } from 'react'

const ARROWS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

function isTypingTarget(target) {
  if (!target || !target.tagName) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Клавіатурне керування грою.
 *
 * Слухач висить на window, а не на елементі поля: у грі немає гарантованого
 * фокуса, і дитина не має спершу дошукуватися Tab'ом, куди саме тиснути.
 *
 * `preventDefault` тут несе вагу, а не косметику. Пробіл і Enter активують
 * сфокусовану кнопку: якщо дитина дійшла до варіанта Tab'ом і натисла Пробіл,
 * спрацював би і рідний клік кнопки, і цей обробник — дві відповіді на одну
 * пробу. У <button> рідна активація відбувається на keyup для Пробілу і на
 * keydown для Enter, і preventDefault на keydown знімає обидві, тож лишається
 * один шлях.
 *
 * Обробники читаються з ref, а не з замикання: інакше кожен рендер (а їх у грі
 * багато — таймери, фази, зворотний зв'язок) перепідписував би слухач.
 * Оновлення ref у useLayoutEffect, а не у звичайному: layout-ефект виконується
 * синхронно після коміту, до того як браузер устигне доставити наступне
 * натискання, тож вікна зі старим обробником не лишається.
 */
export function useGameKeys({
  enabled = true,
  digitCount = 9,
  onDigit,
  onSpace,
  onEnter,
  onArrow,
}) {
  const handlers = useRef({ digitCount, onDigit, onSpace, onEnter, onArrow })

  useLayoutEffect(() => {
    handlers.current = { digitCount, onDigit, onSpace, onEnter, onArrow }
  })

  useEffect(() => {
    if (!enabled) return undefined

    function handleKeyDown(event) {
      // Затиснута клавіша не має перетворюватись на чергу відповідей.
      if (event.repeat) return
      // Ctrl+1 перемикає вкладку, Alt+← вертає назад — гра їх не перехоплює.
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (isTypingTarget(event.target)) return

      const { digitCount: count, onDigit: digit, onSpace: space, onEnter: enter, onArrow: arrow } =
        handlers.current

      if (digit && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        // Цифра поза набором варіантів не перехоплюється: хай браузер робить
        // із нею що завжди, ніж гра мовчки з'їдала б натискання.
        if (index < count) {
          event.preventDefault()
          digit(index)
        }
        return
      }

      if (space && (event.code === 'Space' || event.key === ' ')) {
        event.preventDefault()
        space()
        return
      }

      if (enter && event.key === 'Enter') {
        event.preventDefault()
        enter()
        return
      }

      if (arrow && ARROWS[event.key]) {
        event.preventDefault()
        arrow(ARROWS[event.key])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
