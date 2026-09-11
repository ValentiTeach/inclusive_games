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
 * Цифри розведені на два обробники навмисно. `onOption` — це «цифра 1..N
 * вибирає варіант», і нуль там нічого не означає. `onDigit` — сира цифра для
 * набору числа: у сітці Шульте 6×6 є 10, 20 і 30. Гра користується чимось
 * одним; якщо задані обидва, цифра в межах варіантів іде в onOption.
 *
 * Обробники читаються з ref, а не з замикання: інакше кожен рендер (а їх у грі
 * багато — таймери, фази, зворотний зв'язок) перепідписував би слухач.
 * Оновлення ref у useLayoutEffect, а не у звичайному: layout-ефект виконується
 * синхронно після коміту, до того як браузер устигне доставити наступне
 * натискання, тож вікна зі старим обробником не лишається.
 */
export function useGameKeys({
  enabled = true,
  optionCount = 0,
  onOption,
  onDigit,
  onSpace,
  onEnter,
  onArrow,
  onCancel,
  onLetter,
}) {
  const handlers = useRef(null)

  useLayoutEffect(() => {
    handlers.current = {
      optionCount,
      onOption,
      onDigit,
      onSpace,
      onEnter,
      onArrow,
      onCancel,
      onLetter,
    }
  })

  useEffect(() => {
    if (!enabled) return undefined

    function handleKeyDown(event) {
      // Затиснута клавіша не має перетворюватись на чергу відповідей.
      if (event.repeat) return
      // Ctrl+1 перемикає вкладку, Alt+← вертає назад — гра їх не перехоплює.
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (isTypingTarget(event.target)) return

      const {
        optionCount: count,
        onOption: option,
        onDigit: digit,
        onSpace: space,
        onEnter: enter,
        onArrow: arrow,
        onCancel: cancel,
        onLetter: letter,
      } = handlers.current

      if ((option || digit) && /^[0-9]$/.test(event.key)) {
        const value = Number(event.key)

        // Дві різні речі, тому й два обробники. onOption — «цифра 1..N вибирає
        // варіант», нуль там нічого не означає. onDigit — сира цифра для набору
        // числа: у сітці Шульте 6×6 є 10, 20 і 30, і без нуля їх не набрати.
        if (option && value >= 1 && value <= count) {
          event.preventDefault()
          option(value - 1)
          return
        }

        if (digit) {
          event.preventDefault()
          digit(value)
          return
        }

        // Цифра поза набором варіантів не перехоплюється: хай браузер робить
        // із нею що завжди, ніж гра мовчки з'їдала б натискання.
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
        return
      }

      // Набране число треба вміти стерти, не чекаючи, поки воно розв'яжеться
      // помилковою відповіддю.
      if (cancel && (event.key === 'Escape' || event.key === 'Backspace')) {
        event.preventDefault()
        cancel()
        return
      }

      // Найзагальніша гілка, тому остання: якщо гра просить і Пробіл, і літери,
      // Пробіл має лишитися Пробілом. Код клавіші йде поруч із символом, бо
      // клавіатурний тренажер має впізнати правильний палець навіть тоді, коли
      // в системі стоїть чужа розкладка.
      if (letter && event.key.length === 1) {
        event.preventDefault()
        letter({ key: event.key, code: event.code })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
