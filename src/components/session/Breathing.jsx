import { useEffect, useState } from 'react'
import Helper from '../ui/Helper'
import Button from '../ui/Button'
import SpeakButton from '../../games/engine/SpeakButton'

const PHASE_MS = 4000

/**
 * Дихальна вправа: коло росте на вдиху й меншає на видиху, по чотири секунди.
 * Без руху (налаштування «без анімацій» чи сенсорний профіль) коло стоїть, а
 * говорить лише напис — ритм лишається, рух зникає.
 */
function Breathing({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds)
  const [inhale, setInhale] = useState(true)

  useEffect(() => {
    const tick = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    const swap = setInterval(() => setInhale((value) => !value), PHASE_MS)
    return () => {
      clearInterval(tick)
      clearInterval(swap)
    }
  }, [])

  return (
    <div className="breathing">
      <div className="helper-say">
        <Helper pose="calm" size={64} />
        <p className="helper-say__bubble">Подихаймо разом зі мною.</p>
        <SpeakButton text="Подихаймо разом. Вдих — коло росте. Видих — коло меншає." auto />
      </div>
      <div className={inhale ? 'breathing__circle is-in' : 'breathing__circle'} aria-hidden="true" />
      <p className="breathing__phase" aria-live="polite">
        {inhale ? 'Вдих…' : 'Видих…'}
      </p>
      <p className="breathing__left">
        {left > 0 ? `Ще ${left} с` : 'Готово!'}
      </p>
      <div className="session-run__actions">
        <Button onClick={() => onDone(false)} variant={left > 0 ? 'secondary' : 'primary'}>
          Далі
        </Button>
      </div>
    </div>
  )
}

export default Breathing
