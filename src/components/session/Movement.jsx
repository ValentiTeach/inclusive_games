import { useEffect, useState } from 'react'
import Helper from '../ui/Helper'
import Button from '../ui/Button'
import SpeakButton from '../../games/engine/SpeakButton'

/*
 * Фізхвилинка: повтори рух за Совеням. Балів тут немає й не буде — це пауза
 * для тіла, а не ще одна перевірка.
 */
const MOVES = [
  { pose: 'cheer', text: 'Підніми руки вгору й потягнись!' },
  { pose: 'wide', text: 'Розведи руки в сторони, як крила.' },
  { pose: 'wave', text: 'Помахай рукою — привітайся!' },
  { pose: 'explain', text: 'Покажи рукою вбік, а тоді в інший бік.' },
  { pose: 'calm', text: 'Опусти руки й тихенько подихай.' },
]

function Movement({ seconds, onDone }) {
  const perMove = Math.max(5, Math.round(seconds / MOVES.length)) * 1000
  const [index, setIndex] = useState(0)
  const finished = index >= MOVES.length - 1

  useEffect(() => {
    if (finished) return undefined
    const timer = setTimeout(() => setIndex((value) => value + 1), perMove)
    return () => clearTimeout(timer)
  }, [index, finished, perMove])

  const move = MOVES[index]

  return (
    <div className="movement">
      <Helper pose={move.pose} size={140} label={`Совеня: ${move.text}`} />
      <p className="movement__text" aria-live="polite">
        {move.text}
      </p>
      <SpeakButton key={index} text={move.text} auto />
      <p className="movement__count">
        Рух {index + 1} з {MOVES.length}
      </p>
      <div className="session-run__actions">
        <Button onClick={() => onDone(false)} variant={finished ? 'primary' : 'secondary'}>
          Далі
        </Button>
      </div>
    </div>
  )
}

export default Movement
