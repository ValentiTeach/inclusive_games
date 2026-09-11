import { useEffect, useRef, useState } from 'react'
import {
  KEYBOARD_ROWS,
  generateTrial,
  letterForCode,
  scoring,
} from './keyboardTrainer.config'
import { now } from '../engine/time'
import { useGameKeys } from '../engine/useGameKeys'
import { playCorrect, playWrong } from '../../lib/sound'
import './KeyboardTrainerPlayArea.css'

function KeyboardTrainerPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [position, setPosition] = useState(0)
  const [shake, setShake] = useState(false)
  const [wrongLayout, setWrongLayout] = useState(false)
  const resultsRef = useRef([])
  const lastKeyAtRef = useRef(null)

  useEffect(() => {
    lastKeyAtRef.current = now()
  }, [trial])

  const expected = trial.text[position]

  /**
   * Одне натискання — один запис. Рівень зі словами дає кілька натискань на
   * пробу, тож рахуємо саме символи: інакше слово з однією помилкою важило б
   * стільки ж, скільки промазана літера.
   */
  function register(correct) {
    const at = now()
    resultsRef.current.push({ correct, reactionTimeMs: Math.round(at - lastKeyAtRef.current) })
    lastKeyAtRef.current = at
  }

  function advance() {
    const nextIndex = trialIndex + 1

    if (nextIndex >= level.trialCount) {
      onFinish(scoring(resultsRef.current))
      return
    }

    setTrialIndex(nextIndex)
    setTrial((previous) => generateTrial(level, previous.text))
    setPosition(0)
  }

  function handleLetter(typed) {
    if (typed === expected) {
      register(true)
      playCorrect()

      if (position + 1 < trial.text.length) {
        setPosition((value) => value + 1)
        return
      }

      advance()
      return
    }

    register(false)
    playWrong()
    setShake(true)
    setTimeout(() => setShake(false), 220)
  }

  useGameKeys({
    onLetter: ({ key, code }) => {
      const typed = key.toLowerCase()

      if (typed === expected) {
        // Підказку про розкладку гасить лише натискання, яке прийшло правильним
        // символом, — а не будь-яка правильна відповідь. Інакше вона зникала б
        // на тому ж натисканні, що її поставило.
        setWrongLayout(false)
        handleLetter(typed)
        return
      }

      /**
       * Правильний палець, чужа розкладка. На шкільному комп'ютері часто стоїть
       * англійська, і тоді та сама фізична клавіша дає «f» замість «а». Рахувати
       * це помилкою означало б карати дитину за налаштування комп'ютера — тож
       * зараховуємо натискання і кажемо, у чому річ.
       */
      if (letterForCode(code) === expected) {
        setWrongLayout(true)
        handleLetter(expected)
        return
      }

      handleLetter(typed)
    },
  })

  return (
    <div className="keyboard-trainer">
      <p className="keyboard-trainer__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>

      <p className={shake ? 'keyboard-trainer__target is-wrong' : 'keyboard-trainer__target'}>
        {[...trial.text].map((character, index) => (
          <span
            key={index}
            className={[
              'keyboard-trainer__char',
              index < position ? 'is-done' : '',
              index === position ? 'is-current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {character}
          </span>
        ))}
      </p>

      {wrongLayout && (
        <p className="keyboard-trainer__layout-note">
          Схоже, розкладка не українська. Натискання зараховано — але варто
          перемкнути мову, щоб букви справді друкувалися.
        </p>
      )}

      {/* Клавіатура тут працює на два боки: на комп'ютері це підказка, де
          шукати клавішу, а на телефоні й планшеті — сам спосіб грати. */}
      <div className="keyboard-trainer__keyboard" role="group" aria-label="Клавіатура">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboard-trainer__row">
            {row.map(([code, letter]) => (
              <button
                key={code}
                type="button"
                className={
                  letter === expected
                    ? 'keyboard-trainer__key is-target'
                    : 'keyboard-trainer__key'
                }
                onClick={() => handleLetter(letter)}
                aria-label={`Літера ${letter}`}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default KeyboardTrainerPlayArea
