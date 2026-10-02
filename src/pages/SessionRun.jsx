import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { getPlan, listMyRuns, startRun, updateRun } from '../lib/sessions'
import { getActiveAdaptations } from '../lib/adaptations'
import { groupVaultKey, seal } from '../lib/vault'
import { moodContext } from '../lib/diary'
import { buildGarden, plantName } from '../lib/garden'
import { GAMES } from '../data/games'
import { getResults } from '../games/engine/storage'
import { localDay } from '../lib/day'
import { GAME_REGISTRY } from '../games/registry'
import { FELT_OPTIONS } from '../games/engine/felt'
import GameShell from '../games/engine/GameShell'
import Schedule from '../components/session/Schedule'
import MoodPicker from '../components/session/MoodPicker'
import Breathing from '../components/session/Breathing'
import Movement from '../components/session/Movement'
import Helper from '../components/ui/Helper'
import Garden from '../components/ui/Garden'
import Button from '../components/ui/Button'
import '../components/session/Session.css'
import './SessionRun.css'

/**
 * Проходження заняття дитиною.
 *
 * Перерва й обмеження тривалості перевіряються лише МІЖ кроками: зупинити
 * дитину посеред гри означало б зіпсувати і спробу, і настрій.
 *
 * Настрій і «як тобі було» шифруються відкритим ключем учителя групи ще тут, у
 * браузері дитини (lib/vault). Якщо вчитель не створив захищеного щоденника,
 * настрій не зберігається зовсім — а не зберігається відкрито. Дитині про це
 * не кажуть: питання про настрій однаково має сенс як ритуал.
 *
 * Перегляд для вчителя (`state.preview`) — те саме заняття без жодного запису.
 */

function GreetingStep({ name, mood, onMood, onDone }) {
  return (
    <div className="session-step">
      <div className="helper-say">
        <Helper pose="wave" size={88} />
        <p className="helper-say__bubble">
          Привіт{name ? `, ${name}` : ''}! Я Совеня. Сьогодні займаємось разом.
        </p>
      </div>
      <h2 id="mood-before">Який у тебе зараз настрій?</h2>
      <MoodPicker value={mood} onChange={onMood} labelledBy="mood-before" />
      <div className="session-run__actions">
        <Button onClick={() => onDone(false)}>Почнімо</Button>
      </div>
    </div>
  )
}

function ReflectionStep({ felt, onFelt, mood, onMood, onDone }) {
  return (
    <div className="session-step">
      <div className="helper-say">
        <Helper pose="cheer" size={88} />
        <p className="helper-say__bubble">Ми впорались! Розкажи, як було.</p>
      </div>
      <h2 id="felt-q">Як тобі було?</h2>
      <div className="session-run__felt" role="group" aria-labelledby="felt-q">
        {FELT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={felt === option.id ? 'mood-picker__option is-chosen' : 'mood-picker__option'}
            aria-pressed={felt === option.id}
            onClick={() => onFelt(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <h2 id="mood-after">А який настрій зараз?</h2>
      <MoodPicker value={mood} onChange={onMood} labelledBy="mood-after" />
      <div className="session-run__actions">
        <Button onClick={() => onDone(false)}>Завершити заняття</Button>
      </div>
    </div>
  )
}

function GameStep({ step, battery, onDone }) {
  const entry = GAME_REGISTRY[step.gameId]
  if (!entry) {
    return (
      <div className="session-step">
        <p>Цієї гри вже немає. Переходимо далі.</p>
        <Button onClick={() => onDone(true)}>Далі</Button>
      </div>
    )
  }
  const { config, PlayArea } = entry
  return (
    <>
      <GameShell
        config={config}
        session={{
          levelId: step.levelId,
          battery,
          onDone: () => onDone(false),
        }}
        renderPlay={(level, onFinish) => (
          <Suspense fallback={<p className="game-shell__loading">Гра завантажується…</p>}>
            <PlayArea level={level} onFinish={onFinish} />
          </Suspense>
        )}
      />
      {/* Гру, яка сьогодні не йде, можна пропустити: застрягнути на ній —
        гірше для заняття, ніж пропущений крок, який учитель побачить у звіті. */}
      {!battery && (
        <div className="session-run__skip">
          <button type="button" className="session-run__skip-button" onClick={() => onDone(true)}>
            Пропустити цю гру
          </button>
        </div>
      )}
    </>
  )
}

function practiceDays() {
  return GAMES.flatMap((game) =>
    getResults(game.id).map((attempt) => localDay(new Date(attempt.date))),
  )
}

function SessionRun() {
  const { planId } = useParams()
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  const preview = location.state?.preview ?? null

  const [plan, setPlan] = useState(preview)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('ready')
  const [index, setIndex] = useState(0)
  const [marks, setMarks] = useState([])
  const [moodBefore, setMoodBefore] = useState(null)
  const [moodAfter, setMoodAfter] = useState(null)
  const [felt, setFelt] = useState(null)
  const [garden, setGarden] = useState(null)
  const runRef = useRef(null)
  const keyRef = useRef(null)
  const startedAtRef = useRef(0)
  const lastBreakRef = useRef(0)

  useEffect(() => {
    if (preview || !user) return undefined
    let cancelled = false
    getPlan(planId)
      .then((data) => {
        if (cancelled) return
        if (!data || data.archived_at) setError('Це заняття вже недоступне.')
        else setPlan(data)
      })
      .catch(() => !cancelled && setError('Не вдалося завантажити заняття.'))
    return () => {
      cancelled = true
    }
  }, [planId, preview, user])

  if (!isCloudConfigured) {
    return (
      <section className="session-run">
        <h1>Заняття</h1>
        <p>Заняття від учителя працюють, коли сайт підключено до хмари.</p>
      </section>
    )
  }

  if (loading) return null

  if (!user && !preview) {
    return (
      <section className="session-run">
        <h1>Заняття</h1>
        <p>Щоб пройти заняття, приєднайся до групи за кодом учителя.</p>
        <Link to="/join">Приєднатися</Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="session-run">
        <h1>Заняття</h1>
        <p>{error}</p>
        <Link to="/games">До каталогу</Link>
      </section>
    )
  }

  if (!plan) {
    return (
      <section className="session-run">
        <h1>Заняття</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  const steps = plan.steps
  const battery = plan.kind === 'battery'

  /* Запис — тихо: дитина не має бачити помилок мережі посеред заняття. */
  function save(patch) {
    if (preview || !runRef.current) return
    updateRun(runRef.current, patch).catch(() => {})
  }

  async function sealFor(value, when) {
    if (preview || !runRef.current || !keyRef.current) return null
    try {
      return await seal(keyRef.current, value, moodContext(runRef.current, when))
    } catch {
      return null
    }
  }

  async function handleStart() {
    startedAtRef.current = Date.now()
    lastBreakRef.current = Date.now()
    if (preview) {
      setPhase('step')
      return
    }
    /*
     * Перший крок — питання про настрій, і відповісти на нього дитина може за
     * секунду. Тож і запис заняття, і ключ учителя мають бути вже на руках,
     * інакше перша відповідь пропала б.
     */
    const [run, key] = await Promise.all([
      // Без запису заняття однаково проходиться: бали йдуть у results як
      // звичайні спроби, просто звіт по заняттю їх не збере.
      startRun(plan.id, getActiveAdaptations()).catch(() => null),
      groupVaultKey(profile?.group_id),
    ])
    runRef.current = run?.id ?? null
    keyRef.current = key
    startedAtRef.current = Date.now()
    lastBreakRef.current = Date.now()
    setPhase('step')
  }

  async function handleMoodBefore(mood) {
    setMoodBefore(mood)
    const sealed = await sealFor({ mood }, 'before')
    if (sealed) save({ mood_before: sealed })
  }

  async function handleMoodAfter(mood) {
    setMoodAfter(mood)
    const sealed = await sealFor({ mood }, 'after')
    if (sealed) save({ mood_after: sealed })
  }

  async function handleFelt(value) {
    setFelt(value)
    const sealed = await sealFor({ felt: value }, 'reflection')
    if (sealed) save({ reflection: sealed })
  }

  async function finish(allMarks) {
    const finishedAt = new Date().toISOString()
    save({ steps_done: allMarks, finished_at: finishedAt })
    let sessionDates = [finishedAt]
    if (!preview && user) {
      try {
        const runs = await listMyRuns(user.id)
        sessionDates = [
          ...runs
            .filter((run) => run.finished_at && run.id !== runRef.current)
            .map((run) => run.finished_at),
          finishedAt,
        ]
      } catch {
        // Сад покаже хоча б цю квітку.
      }
    }
    setGarden(buildGarden({ days: practiceDays(), sessionDates }))
    setPhase('done')
  }

  function goTo(nextIndex, allMarks) {
    if (nextIndex >= steps.length) {
      finish(allMarks)
      return
    }

    const now = Date.now()
    const elapsedMin = (now - startedAtRef.current) / 60000
    const reflectionIndex = steps.findIndex(
      (step, i) => i >= nextIndex && step.kind === 'reflection',
    )

    // Час вийшов: решта кроків пропускається, але рефлексія лишається —
    // закінчити заняття розмовою важливіше, ніж ще однією грою.
    if (
      plan.max_minutes &&
      elapsedMin >= plan.max_minutes &&
      steps[nextIndex].kind !== 'reflection'
    ) {
      const skipped = []
      const stopAt = reflectionIndex === -1 ? steps.length : reflectionIndex
      for (let i = nextIndex; i < stopAt; i += 1) {
        skipped.push({ i, at: new Date().toISOString(), skipped: true })
      }
      const updated = [...allMarks, ...skipped]
      setMarks(updated)
      save({ steps_done: updated })
      setIndex(stopAt)
      if (stopAt >= steps.length) finish(updated)
      else setPhase('timeup')
      return
    }

    setIndex(nextIndex)
    if (
      plan.break_every_minutes &&
      now - lastBreakRef.current >= plan.break_every_minutes * 60000
    ) {
      setPhase('break')
    } else {
      setPhase('step')
    }
  }

  function handleStepDone(skipped) {
    const mark = {
      i: index,
      at: new Date().toISOString(),
      ...(skipped ? { skipped: true } : {}),
    }
    const updated = [...marks, mark]
    setMarks(updated)
    save({ steps_done: updated })
    window.scrollTo?.({ top: 0 })
    goTo(index + 1, updated)
  }

  const step = steps[index]

  return (
    <section className="session-run">
      <h1>{plan.title}</h1>
      {preview && (
        <p className="session-run__preview">
          Перегляд: так заняття побачить дитина. Нічого не зберігається.
        </p>
      )}

      {phase !== 'done' && (
        <Schedule steps={steps} current={phase === 'ready' ? -1 : index} marks={marks} />
      )}

      {phase === 'ready' && (
        <div className="session-step">
          <div className="helper-say">
            <Helper pose="wave" size={88} />
            <p className="helper-say__bubble">
              Ось план заняття: {steps.length} {steps.length < 5 ? 'кроки' : 'кроків'}. Можна
              починати, коли будеш готовий.
            </p>
          </div>
          <Button onClick={handleStart}>Почати заняття</Button>
        </div>
      )}

      {phase === 'break' && (
        <div className="session-step">
          <div className="helper-say">
            <Helper pose="calm" size={88} />
            <p className="helper-say__bubble">Час перепочити. Встань, потягнись, попий води.</p>
          </div>
          <Button
            onClick={() => {
              lastBreakRef.current = Date.now()
              setPhase('step')
            }}
          >
            Продовжити
          </Button>
        </div>
      )}

      {phase === 'timeup' && (
        <div className="session-step">
          <div className="helper-say">
            <Helper pose="explain" size={88} />
            <p className="helper-say__bubble">
              Час заняття майже вийшов. Переходимо до завершення.
            </p>
          </div>
          <Button onClick={() => setPhase('step')}>Добре</Button>
        </div>
      )}

      {phase === 'step' && step && (
        <div className="session-run__step" key={index}>
          {step.kind === 'greeting' && (
            <GreetingStep
              name={profile?.display_name}
              mood={moodBefore}
              onMood={handleMoodBefore}
              onDone={handleStepDone}
            />
          )}
          {step.kind === 'breathing' && (
            <Breathing seconds={step.seconds} onDone={handleStepDone} />
          )}
          {step.kind === 'movement' && <Movement seconds={step.seconds} onDone={handleStepDone} />}
          {step.kind === 'game' && (
            <GameStep step={step} battery={battery} onDone={handleStepDone} />
          )}
          {step.kind === 'reflection' && (
            <ReflectionStep
              felt={felt}
              onFelt={handleFelt}
              mood={moodAfter}
              onMood={handleMoodAfter}
              onDone={handleStepDone}
            />
          )}
        </div>
      )}

      {phase === 'done' && garden && (
        <div className="session-step">
          <div className="helper-say">
            <Helper pose="cheer" size={88} />
            <p className="helper-say__bubble">
              Заняття завершено! У твоєму саду з’явилась нова рослина —{' '}
              {plantName(garden.items.at(-1)?.plant)}.
            </p>
          </div>
          <Garden garden={garden} highlightLast />
          <div className="session-run__actions">
            <Button to="/games">До каталогу</Button>
            <Button to="/progress" variant="secondary">
              Мій сад і прогрес
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default SessionRun
