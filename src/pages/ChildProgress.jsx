import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import {
  fetchChildResults,
  fetchMyChildren,
  redeemParentInvite,
  PARENT_ERROR_TEXT,
} from '../lib/parents'
import { GAMES, CATEGORIES } from '../data/games'
import { metricLabel } from '../games/engine/metrics'
import { highlightMetrics, improvement } from '../lib/progressMetrics'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import './ChildProgress.css'

const GAME_BY_ID = Object.fromEntries(GAMES.map((game) => [game.id, game]))

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Спроби, згруповані за грою, найновіші спершу — саме такий вигляд чекають highlightMetrics. */
function byGame(results) {
  const groups = new Map()
  for (const row of results) {
    const list = groups.get(row.game_id) ?? []
    list.push({ score: row.score, metrics: row.metrics, date: row.played_at })
    groups.set(row.game_id, list)
  }
  return [...groups.entries()]
    .map(([gameId, history]) => ({
      gameId,
      game: GAME_BY_ID[gameId],
      history,
      best: Math.max(...history.map((attempt) => attempt.score)),
      last: history[0]?.date,
      highlights: highlightMetrics(history),
      growth: improvement(history),
    }))
    .filter((entry) => entry.game)
    .sort((a, b) => new Date(b.last) - new Date(a.last))
}

function ChildProgress() {
  const { user, profile, loading } = useAuth()
  const [children, setChildren] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [results, setResults] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState(null)

  const reload = useCallback(async () => {
    if (!user) return
    const list = await fetchMyChildren(user.id)
    setChildren(list)
    setActiveId((current) => current ?? list[0]?.id ?? null)
  }, [user])

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false
    fetchMyChildren(user.id)
      .then((list) => {
        if (cancelled) return
        setChildren(list)
        setActiveId((current) => current ?? list[0]?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setChildren([])
      })

    return () => {
      cancelled = true
    }
  }, [user])

  /*
   * Спроби зберігаються разом з тим, чиї вони. Інакше при перемиканні між
   * дітьми на екрані лишалися б чужі числа доти, доки не прийде відповідь, — а
   * підписані вони були б уже іншим іменем.
   */
  useEffect(() => {
    if (!activeId) return undefined

    let cancelled = false
    fetchChildResults(activeId)
      .then((rows) => {
        if (!cancelled) setResults({ studentId: activeId, rows })
      })
      .catch(() => {
        if (!cancelled) setResults({ studentId: activeId, rows: [] })
      })

    return () => {
      cancelled = true
    }
  }, [activeId])

  async function handleRedeem(event) {
    event.preventDefault()
    setBusy(true)
    setErrorText(null)
    try {
      const studentId = await redeemParentInvite(code)
      setCode('')
      await reload()
      setActiveId(studentId)
    } catch (error) {
      setErrorText(PARENT_ERROR_TEXT[error?.reason] ?? PARENT_ERROR_TEXT.unknown)
    } finally {
      setBusy(false)
    }
  }

  if (!isCloudConfigured) {
    return (
      <section className="child-progress">
        <h1>Моя дитина</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="child-progress">
        <h1>Моя дитина</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const active = children?.find((child) => child.id === activeId) ?? null
  const rows = results?.studentId === activeId ? results.rows : null
  const games = rows ? byGame(rows) : null
  const totalAttempts = rows?.length ?? 0

  return (
    <section className="child-progress">
      <h1>Моя дитина</h1>

      {children !== null && children.length === 0 && (
        <p className="child-progress__intro">
          Тут видно, як дитина грає: скільки спроб, у яких іграх і що в неї виходить
          найкраще. Щоб почати, попросіть у вчителя код — він виписує його на вашу
          дитину окремо.
        </p>
      )}

      <form className="child-progress__form" onSubmit={handleRedeem}>
        <label className="child-progress__label" htmlFor="parent-code">
          Код від учителя
        </label>
        <div className="child-progress__row">
          <input
            id="parent-code"
            className="child-progress__input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABCD2345"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={busy || code.trim().length === 0}>
            {busy ? 'Перевіряю…' : 'Додати дитину'}
          </Button>
        </div>
        {errorText && <p className="child-progress__error">{errorText}</p>}
      </form>

      {children !== null && children.length > 1 && (
        <div className="child-progress__switch" role="group" aria-label="Оберіть дитину">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              className={
                child.id === activeId
                  ? 'child-progress__chip child-progress__chip--active'
                  : 'child-progress__chip'
              }
              aria-pressed={child.id === activeId}
              onClick={() => setActiveId(child.id)}
            >
              {child.display_name ?? 'Без імені'}
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          <h2 className="child-progress__name">{active.display_name ?? 'Без імені'}</h2>

          {rows === null && <p>Завантаження…</p>}

          {rows !== null && totalAttempts === 0 && (
            <p className="child-progress__empty">
              Дитина ще не зіграла жодної гри. Щойно зіграє — тут з’явиться, що саме.
            </p>
          )}

          {games !== null && games.length > 0 && (
            <>
              <p className="child-progress__summary">
                Усього спроб: <strong>{totalAttempts}</strong> у {games.length}{' '}
                {games.length === 1 ? 'грі' : 'іграх'}.
              </p>

              <ul className="child-progress__games">
                {games.map((entry) => (
                  <li key={entry.gameId} className="child-progress__game">
                    <div className="child-progress__game-head">
                      <h3>{entry.game.title}</h3>
                      <Badge tone={CATEGORIES[entry.game.category].color}>
                        {CATEGORIES[entry.game.category].label}
                      </Badge>
                    </div>

                    <p className="child-progress__game-meta">
                      Спроб: {entry.history.length} · Найкращий бал: {entry.best} ·
                      Востаннє: {formatDate(entry.last)}
                    </p>

                    {entry.highlights.length > 0 && (
                      <dl className="child-progress__metrics">
                        {entry.highlights.map(({ key, value }) => (
                          <div key={key}>
                            <dt>{metricLabel(key)}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {/*
                      Зростання показується тільки тоді, коли воно пораховане на
                      достатній кількості спроб: improvement повертає null, поки
                      їх менше чотирьох. Обіцяти батькам поступ із двох ігор
                      означало б продавати випадковість за результат.
                    */}
                    {entry.growth !== null && (
                      <p
                        className={
                          entry.growth >= 0
                            ? 'child-progress__growth'
                            : 'child-progress__growth child-progress__growth--down'
                        }
                      >
                        {entry.growth >= 0
                          ? `Бал виріс на ${entry.growth} порівняно з першими спробами.`
                          : `Бал знизився на ${Math.abs(entry.growth)} порівняно з першими спробами.`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {profile?.role === 'student' && children?.length === 0 && (
        <p className="child-progress__note">
          Ця сторінка для дорослих. Свої власні результати ви бачите в розділі «Мій
          прогрес».
        </p>
      )}
    </section>
  )
}

export default ChildProgress
