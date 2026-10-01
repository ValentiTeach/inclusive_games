import { useEffect, useRef, useState } from 'react'
import { Ear } from 'lucide-react'
import { LISTS, checkAnswer, generateSequence, scoring } from './listenCatch.config'
import { now } from '../engine/time'
import { playCorrect, playWrong } from '../../lib/sound'
import { speak, stopSpeaking, useUkrainianVoice } from '../../lib/speech'
import { useGameKeys } from '../engine/useGameKeys'
import './ListenCatchPlayArea.css'

const LEAD_IN_MS = 800
const GAP_MS = 500
/* Якщо голос так і не сказав, що закінчив, — не чекаємо вічно. */
const SPEECH_TIMEOUT_MS = 3000
/* Без голосу слово видно стільки, скільки звучало б. */
const TEXT_MS = 900

function ListenCatchPlayArea({ level, onFinish }) {
  const voice = useUkrainianVoice()
  const [sequence] = useState(() => generateSequence(level))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('lead')
  const [windowOpen, setWindowOpen] = useState(false)
  const [flash, setFlash] = useState(null)
  const pressedRef = useRef(false)
  const pressedAtRef = useRef(null)
  const startedAtRef = useRef(null)
  const resultsRef = useRef([])
  const timersRef = useRef([])

  const trial = sequence[index]
  const shownWord = !voice && phase === 'word' && !windowOpen ? trial.word : null

  function later(fn, ms) {
    timersRef.current.push(setTimeout(fn, ms))
  }

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    stopSpeaking()
  }, [])

  /*
   * Одна проба: слово звучить (або показується), а потім ще `windowMs` можна
   * натиснути. Вікно відраховується від кінця слова: довге «носоріг» не має
   * з'їдати час на відповідь.
   */
  useEffect(() => {
    if (phase !== 'lead') return undefined
    const timer = setTimeout(() => setPhase('word'), index === 0 ? LEAD_IN_MS : GAP_MS)
    return () => clearTimeout(timer)
  }, [phase, index])

  function finishTrial() {
    const { correct, outcome } = checkAnswer(trial, pressedRef.current)
    resultsRef.current.push({
      correct,
      outcome,
      reactionTimeMs: pressedRef.current ? Math.round(pressedAtRef.current - startedAtRef.current) : undefined,
    })
    // Звук відгуку — лише на хибне натискання, а не на кожну пробу: інакше
    // між словами весь час щось дзенькало б і заглушало наступне слово.
    if (outcome === 'false-alarm') playWrong()

    const next = index + 1
    if (next >= sequence.length) {
      onFinish(scoring(resultsRef.current))
      return
    }
    setFlash(null)
    setWindowOpen(false)
    setIndex(next)
    setPhase('lead')
  }

  useEffect(() => {
    if (phase !== 'word') return
    pressedRef.current = false
    startedAtRef.current = now()
    let opened = false
    const openWindow = () => {
      if (opened) return
      opened = true
      setWindowOpen(true)
      later(() => finishTrial(), level.windowMs)
    }

    if (voice) {
      speak(trial.word, { onEnd: openWindow })
      later(openWindow, SPEECH_TIMEOUT_MS)
    } else {
      later(openWindow, TEXT_MS)
    }
    // Проба запускається один раз на фазу; функції всередині читають ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function handlePress() {
    if (phase !== 'word' || pressedRef.current) return
    pressedRef.current = true
    pressedAtRef.current = now()
    const good = trial.isTarget
    setFlash(good ? 'right' : 'wrong')
    if (good) playCorrect()
  }

  useGameKeys({ enabled: phase === 'word', onSpace: handlePress, onEnter: handlePress })

  return (
    <div className="listen-catch">
      <p className="listen-catch__progress">
        {index + 1} / {sequence.length}
      </p>
      <p className="listen-catch__prompt">{LISTS[level.list].prompt}</p>
      {!voice && (
        <p className="listen-catch__note">
          На цьому пристрої немає українського голосу, тож слова показуються текстом.
        </p>
      )}

      <div
        className={['listen-catch__speaker', flash ? `is-${flash}` : '', phase === 'word' ? 'is-on' : '']
          .filter(Boolean)
          .join(' ')}
        aria-live="polite"
      >
        {shownWord ? <span className="listen-catch__word">{shownWord}</span> : <Ear size={64} aria-hidden="true" />}
      </div>

      <button
        type="button"
        className="listen-catch__button"
        onPointerDown={(event) => {
          event.preventDefault()
          handlePress()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') event.preventDefault()
        }}
        aria-disabled={phase !== 'word'}
      >
        Це воно!
      </button>
    </div>
  )
}

export default ListenCatchPlayArea
