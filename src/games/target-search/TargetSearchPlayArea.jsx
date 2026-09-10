import { useEffect, useRef, useState } from 'react'
import { generateTrial, checkAnswer, scoring } from './targetSearch.config'
import { now } from '../engine/time'
import { useGameKeys } from '../engine/useGameKeys'
import { nearestInDirection } from '../engine/spatial'
import { playCorrect, playWrong } from '../../lib/sound'
import ShapeIcon from '../engine/ShapeIcon'
import './TargetSearchPlayArea.css'

// Має збігатися з aspect-ratio у TargetSearchPlayArea.css: кут між фігурами
// рахується таким, яким його бачить дитина, а не таким, яким він виходить у
// відсотках поля.
const SCENE_ASPECT = 4 / 3

function TargetSearchPlayArea({ level, onFinish }) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [trial, setTrial] = useState(() => generateTrial(level))
  const [feedback, setFeedback] = useState(null)
  const [cursor, setCursor] = useState(0)
  const resultsRef = useRef([])
  const trialStartRef = useRef(null)
  const itemRefs = useRef([])

  // Скидання курсора при новій пробі — під час рендера, а не в ефекті: це
  // документований патерн React для «стан залежить від того, що змінилось».
  const [renderedTrial, setRenderedTrial] = useState(trial)
  if (renderedTrial !== trial) {
    setRenderedTrial(trial)
    setCursor(0)
  }

  useEffect(() => {
    trialStartRef.current = now()
    // Кожна проба — нова сцена з новими кнопками, і без цього фокус після першої
    // ж відповіді осідав би на body: гра переставала б слухати клавіатуру вже на
    // другій пробі. Програмний фокус не малює кільце тому, хто зайшов мишею:
    // :focus-visible дивиться на те, чим користувалися востаннє.
    itemRefs.current[0]?.focus()
  }, [trial])

  function handleItemClick(item) {
    if (feedback) return

    const reactionTimeMs = Math.round(now() - trialStartRef.current)
    const { correct } = checkAnswer(item)
    resultsRef.current.push({ correct, reactionTimeMs })
    setFeedback(correct ? 'right' : 'wrong')
    if (correct) playCorrect()
    else playWrong()

    setTimeout(() => {
      setFeedback(null)
      const nextIndex = trialIndex + 1

      if (nextIndex >= level.trialCount) {
        onFinish(scoring(resultsRef.current))
        return
      }

      setTrialIndex(nextIndex)
      setTrial(generateTrial(level))
    }, 450)
  }

  function selectUnderCursor() {
    const item = trial.items[cursor]
    if (item) handleItemClick(item)
  }

  useGameKeys({
    enabled: !feedback,
    onArrow: (direction) => {
      const next = nearestInDirection(trial.items, cursor, direction, { aspect: SCENE_ASPECT })
      setCursor(next)
      itemRefs.current[next]?.focus()
    },
    onEnter: () => selectUnderCursor(),
    onSpace: () => selectUnderCursor(),
  })

  return (
    <div className="target-search">
      <p className="target-search__progress">
        {trialIndex + 1} / {level.trialCount}
      </p>
      <div className="target-search__target">
        <span>Знайди:</span>
        <ShapeIcon shape={trial.target.shape} color={trial.target.color} size={36} />
      </div>
      <div className="target-search__scene">
        {trial.items.map((item, index) => (
          <button
            key={item.uid}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            className="target-search__item"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onClick={() => handleItemClick(item)}
            // Курсор іде за фокусом, інакше дитина, що дійшла до фігури Tab'ом,
            // натиснула б Enter — і зарахувалася б зовсім інша.
            onFocus={() => setCursor(index)}
            // Один tabstop на всю сцену: обходити Tab'ом двадцять фігур,
            // розкиданих у випадковому порядку, — це не пошук, а лотерея.
            tabIndex={index === cursor ? 0 : -1}
            // aria-disabled, а не disabled. Клавіші під час зворотного зв'язку
            // мовчать і так (enabled: !feedback вище), але браузер знімає фокус
            // із кнопки, щойно вона стає disabled — перевірено, фокус їде на
            // BODY. Дитина, що натисне Tab у ці 450 мс, поїхала б з початку
            // документа замість того місця, де щойно була. Натискання і так
            // відсіює перевірка в handleItemClick.
            aria-disabled={Boolean(feedback)}
            aria-label="Фігура"
          >
            <ShapeIcon shape={item.shape} color={item.color} size={26} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default TargetSearchPlayArea
