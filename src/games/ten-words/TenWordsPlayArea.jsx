import { useEffect, useMemo, useRef, useState } from 'react'
import { checkRound, generateSet, scoring } from './tenWords.config'
import { playClick, playCorrect } from '../../lib/sound'
import { speak, stopSpeaking, useUkrainianVoice } from '../../lib/speech'
import { getSettings } from '../../lib/settings'
import { shuffle } from '../engine/random'
import { useGameKeys } from '../engine/useGameKeys'
import OptionKey from '../engine/OptionKey'
import Button from '../../components/ui/Button'
import { PICTURES } from '../engine/pictures'
import './TenWordsPlayArea.css'

const GAP_MS = 300
const ROUND_RESULT_MS = 1800

function TenWordsPlayArea({ level, onFinish }) {
  const voice = useUkrainianVoice()
  const [set] = useState(() => generateSet(level))
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState('show')
  const [shown, setShown] = useState(0)
  const [picked, setPicked] = useState(() => new Set())
  const [lastHits, setLastHits] = useState(null)
  const roundsRef = useRef([])

  // Сітку перемішуємо щоразу заново: інакше дитина запам'ятовувала б місця
  // на екрані, а не слова.
  const grid = useMemo(
    () => shuffle([...set.targets, ...set.decoys]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, round],
  )

  const current = set.targets[shown]
  const speakWords = voice && getSettings().voice !== 'off'

  useEffect(() => {
    if (phase !== 'show') return undefined
    if (speakWords && current) speak(current.word)
    const timer = setTimeout(() => {
      if (shown + 1 >= set.targets.length) setPhase('recall')
      else setShown(shown + 1)
    }, level.showMs + GAP_MS)
    return () => clearTimeout(timer)
  }, [phase, shown, current, speakWords, set.targets.length, level.showMs])

  useEffect(() => () => stopSpeaking(), [])

  function toggle(word) {
    if (phase !== 'recall') return
    playClick()
    setPicked((value) => {
      const next = new Set(value)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  function submit() {
    if (phase !== 'recall' || picked.size === 0) return
    const result = checkRound(set, picked)
    roundsRef.current.push(result)
    setLastHits(result.hits)
    setPhase('result')
    playCorrect()

    setTimeout(() => {
      if (roundsRef.current.length >= level.rounds) {
        onFinish(scoring(roundsRef.current, set.targets.length))
        return
      }
      setPicked(new Set())
      setShown(0)
      setRound((value) => value + 1)
      setPhase('show')
    }, ROUND_RESULT_MS)
  }

  useGameKeys({
    enabled: phase === 'recall',
    optionCount: Math.min(9, grid.length),
    onOption: (index) => toggle(grid[index].word),
    onEnter: submit,
  })

  return (
    <div className="ten-words">
      <p className="ten-words__progress">
        Спроба {round + 1} / {level.rounds}
      </p>

      {phase === 'show' && current && (
        <div className="ten-words__card" key={`${round}-${shown}`}>
          {(() => {
            const Picture = PICTURES[current.icon]
            return <Picture size={84} strokeWidth={1.5} aria-hidden="true" />
          })()}
          <span className="ten-words__word">{current.word}</span>
          <span className="ten-words__count">
            {shown + 1} / {set.targets.length}
          </span>
        </div>
      )}

      {phase === 'result' && (
        <p className="ten-words__result" aria-live="polite">
          Знайдено {lastHits} з {set.targets.length}
          {round + 1 < level.rounds ? '. Ще раз — ті самі слова.' : '.'}
        </p>
      )}

      {phase === 'recall' && (
        <>
          <p className="ten-words__prompt">Які слова були? Познач усі.</p>
          <div className="ten-words__grid">
            {grid.map((item, index) => {
              const Picture = PICTURES[item.icon]
              return (
                <button
                  key={item.word}
                  type="button"
                  className={picked.has(item.word) ? 'ten-words__option is-picked' : 'ten-words__option'}
                  onClick={() => toggle(item.word)}
                  aria-pressed={picked.has(item.word)}
                >
                  {index < 9 && <OptionKey n={index + 1} />}
                  <Picture size={30} strokeWidth={1.6} aria-hidden="true" />
                  <span>{item.word}</span>
                </button>
              )
            })}
          </div>
          <Button onClick={submit} disabled={picked.size === 0}>
            Готово
          </Button>
        </>
      )}
    </div>
  )
}

export default TenWordsPlayArea
