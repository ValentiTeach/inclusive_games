import { useEffect, useRef, useState } from 'react'
import { onWrongAnswer } from '../../lib/sound'
import { errorFeedbackMode } from '../../lib/settings'
import Helper from '../../components/ui/Helper'
import './AdaptivePlay.css'

/**
 * Ігрове поле з урахуванням профілю адаптацій дитини.
 *
 * Усі тридцять ігор побудовані на справжніх <button> і на useGameKeys, тож
 * моторні адаптації зроблено один раз — тут, навколо поля, — а не в кожній
 * грі. Гра нічого про них не знає: вона й далі отримує той самий клік.
 *
 * - Утримання (holdMs). Натискання пальцем чи мишею не спрацьовує одразу:
 *   кнопку треба втримати. Відпустив раніше — нічого не сталося. Клік від
 *   клавіатури (detail = 0) проходить без утримання: тремор — це про руку на
 *   екрані, а не про клавішу.
 * - Захист від повтору (repeatGuardMs). Друге натискання протягом цього часу
 *   губиться ще до гри. Для клавіш — лише та сама клавіша: інакше набрати
 *   «17» у Шульте стало б неможливо.
 * - Одна кнопка (scanMs). Доступні кнопки поля підсвічуються по черзі;
 *   Пробіл, Enter або велика кнопка «Вибрати» натискає підсвічену. Ігри, де
 *   кнопка й так одна (Пробіл — уся гра), перебирати нічого не мусять.
 *
 * Блокування стоїть у фазі перехоплення на самому полі: React роздає onClick
 * із кореня застосунку на спливанні, тож зупинена тут подія до гри не дійде.
 */

function buttonOf(root, event) {
  const el = event.target?.closest?.('button, [role="button"]')
  return el && root.contains(el) ? el : null
}

function isAvailable(el) {
  return (
    !el.disabled &&
    el.getAttribute('aria-disabled') !== 'true' &&
    !el.closest('[hidden]') &&
    !el.closest('[data-scan-skip]')
  )
}

function stop(event) {
  event.preventDefault()
  event.stopPropagation()
}

const TRY_AGAIN_MS = 1100

function AdaptivePlay({ config, profile, children }) {
  const rootRef = useRef(null)
  const selectRef = useRef(() => {})
  const [holdBox, setHoldBox] = useState(null)
  const [tryAgain, setTryAgain] = useState(0)

  const input = config.input ?? {}
  const holdMs = input.hold === false ? 0 : profile.holdMs
  const guardMs = profile.repeatGuardMs
  const scanMs = input.scan === false || input.scan === 'native' ? 0 : profile.scanMs

  /* Утримання й захист від повтору для вказівника. */
  useEffect(() => {
    const root = rootRef.current
    if (!root || (!holdMs && !guardMs)) return undefined

    let lastAccepted = -Infinity
    let hold = null

    function cancelHold() {
      if (!hold) return
      clearTimeout(hold.timer)
      hold = null
      setHoldBox(null)
    }

    function onClick(event) {
      const el = buttonOf(root, event)
      if (!el) return
      // Справжній клік пальцем чи мишею має detail ≥ 1. Клік, який робить
      // утримання (el.click()) чи клавіатура, — 0.
      if (holdMs && event.detail > 0) {
        stop(event)
        return
      }
      if (guardMs) {
        const at = performance.now()
        if (at - lastAccepted < guardMs) {
          stop(event)
          return
        }
        lastAccepted = at
      }
    }

    function onPointerDown(event) {
      if (!holdMs) return
      const el = buttonOf(root, event)
      if (!el || !isAvailable(el)) return
      cancelHold()

      const box = el.getBoundingClientRect()
      const frame = root.getBoundingClientRect()
      setHoldBox({
        left: box.left - frame.left,
        top: box.top - frame.top,
        width: box.width,
        height: box.height,
      })
      hold = {
        el,
        timer: setTimeout(() => {
          const target = hold?.el
          hold = null
          setHoldBox(null)
          target?.click()
        }, holdMs),
      }
    }

    function onPointerOut(event) {
      if (hold && !hold.el.contains(event.relatedTarget)) cancelHold()
    }

    root.addEventListener('click', onClick, true)
    root.addEventListener('pointerdown', onPointerDown, true)
    root.addEventListener('pointerout', onPointerOut, true)
    window.addEventListener('pointerup', cancelHold, true)
    window.addEventListener('pointercancel', cancelHold, true)
    return () => {
      cancelHold()
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('pointerout', onPointerOut, true)
      window.removeEventListener('pointerup', cancelHold, true)
      window.removeEventListener('pointercancel', cancelHold, true)
    }
  }, [holdMs, guardMs])

  /* Захист від повтору для клавіш: та сама клавіша двічі поспіль. */
  useEffect(() => {
    if (!guardMs) return undefined
    const last = new Map()

    function onKeyDown(event) {
      if (event.repeat || event.key === 'Escape') return
      const at = performance.now()
      const previous = last.get(event.key) ?? -Infinity
      if (at - previous < guardMs) {
        stop(event)
        return
      }
      last.set(event.key, at)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [guardMs])

  /* Перебір по черзі для керування однією кнопкою. */
  useEffect(() => {
    const root = rootRef.current
    if (!root || !scanMs) return undefined

    let index = -1
    let current = null

    function mark(el) {
      current?.removeAttribute('data-scan-current')
      current = el
      if (el) {
        // Атрибут, а не клас: React переписує className цілком, щойно гра
        // змінить стан кнопки, а чужих атрибутів він не чіпає.
        el.setAttribute('data-scan-current', '')
        el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      }
    }

    function step() {
      const list = [...root.querySelectorAll('button, [role="button"]')].filter(isAvailable)
      if (list.length === 0) {
        mark(null)
        index = -1
        return
      }
      index = (index + 1) % list.length
      mark(list[index])
    }

    selectRef.current = () => {
      if (!current || !current.isConnected || !isAvailable(current)) return
      const el = current
      mark(null)
      index = -1
      el.click()
    }

    function onKeyDown(event) {
      if (event.repeat) return
      if (event.key !== 'Enter' && event.code !== 'Space' && event.key !== ' ') return
      // Кнопка поза полем у фокусі (питання «Вийти з гри?», сама «Вибрати») —
      // її власна: Пробіл має натиснути саме її.
      const focused = event.target
      if (focused?.closest?.('button, input, select, textarea') && !root.contains(focused)) return
      // Пробіл і Enter у цьому режимі — це «вибрати підсвічене», і нічого
      // іншого: гра не має отримати їх ще й як власну відповідь.
      stop(event)
      selectRef.current()
    }

    const timer = setInterval(step, scanMs)
    step()
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKeyDown, true)
      mark(null)
      selectRef.current = () => {}
    }
  }, [scanMs])

  /* М'яка реакція на помилку: спокійне «Спробуй ще» замість червоного. */
  useEffect(
    () =>
      onWrongAnswer(() => {
        if (errorFeedbackMode() === 'gentle') setTryAgain((value) => value + 1)
      }),
    [],
  )

  useEffect(() => {
    if (!tryAgain) return undefined
    const timer = setTimeout(() => setTryAgain(0), TRY_AGAIN_MS)
    return () => clearTimeout(timer)
  }, [tryAgain])

  const classes = ['game-play']
  if (holdMs) classes.push('game-play--hold')

  return (
    <div className="game-play-frame">
      <div ref={rootRef} className={classes.join(' ')} style={{ '--hold-ms': `${holdMs}ms` }}>
        {children}
        {holdBox && (
          <span className="game-play__hold" style={holdBox} aria-hidden="true">
            <span className="game-play__hold-bar" />
          </span>
        )}
        {tryAgain > 0 && (
          <div className="game-play__try-again" role="status">
            <Helper pose="calm" size={44} />
            <span>Спробуй ще</span>
          </div>
        )}
      </div>

      {scanMs > 0 && (
        <div className="game-play__switch" data-scan-skip="">
          <p className="game-play__switch-hint">
            Дочекайся, поки підсвітиться потрібне, і натисни Пробіл або цю кнопку.
          </p>
          <button
            type="button"
            className="game-play__switch-button"
            onClick={() => selectRef.current()}
          >
            Вибрати
          </button>
        </div>
      )}
    </div>
  )
}

export default AdaptivePlay
