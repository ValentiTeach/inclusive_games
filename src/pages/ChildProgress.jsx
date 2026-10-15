import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import {
  fetchChildResults,
  fetchMyChildren,
  fetchMyRequests,
  redeemParentInvite,
  visibleRequests,
  PARENT_ERROR_TEXT,
} from '../lib/parents'
import { GAMES, CATEGORIES } from '../data/games'
import { metricLabel } from '../games/engine/metrics'
import { highlightMetrics, improvement } from '../lib/progressMetrics'
import { buildGroupCsv, csvFileName, downloadCsv } from '../lib/csv'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import MetricHelp from '../components/ui/MetricHelp'
import { useT } from '../i18n/i18n'
import './ChildProgress.css'

const GAME_BY_ID = Object.fromEntries(GAMES.map((game) => [game.id, game]))
const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDate(iso, locale = 'uk') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'uk-UA', {
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
  const t = useT()
  const date = (iso) => formatDate(iso, t.locale)
  const [children, setChildren] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [results, setResults] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [requests, setRequests] = useState([])
  const [submitted, setSubmitted] = useState(false)

  /*
   * Заявки питаються окремо й мовчки: до міграції таблиці ще немає, і це не
   * привід показувати помилку там, де дитину видно й без них.
   */
  const reloadRequests = useCallback(async () => {
    if (!user) return
    try {
      setRequests(visibleRequests(await fetchMyRequests(user.id)))
    } catch {
      setRequests([])
    }
  }, [user])

  const reload = useCallback(async () => {
    if (!user) return
    const list = await fetchMyChildren(user.id)
    setChildren(list)
    setActiveId((current) => current ?? list[0]?.id ?? null)
    await reloadRequests()
  }, [user, reloadRequests])

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

    fetchMyRequests(user.id)
      .then((rows) => {
        if (!cancelled) setRequests(visibleRequests(rows))
      })
      .catch(() => {})

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
    setSubmitted(false)
    try {
      await redeemParentInvite(code)
      setCode('')
      setSubmitted(true)
      await reload()
    } catch (error) {
      const reason = PARENT_ERROR_TEXT[error?.reason] ? error.reason : 'unknown'
      setErrorText(t(`parentError.${reason}`))
    } finally {
      setBusy(false)
    }
  }

  if (!isCloudConfigured) {
    return (
      <section className="child-progress">
        <h1>{t('child.title')}</h1>
        <p>{t('child.notConnected')}</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="child-progress">
        <h1>{t('child.title')}</h1>
        <p>{t('child.loading')}</p>
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
      <h1>{t('child.title')}</h1>

      {children !== null && children.length === 0 && (
        <p className="child-progress__intro">{t('child.intro')}</p>
      )}

      <form className="child-progress__form" onSubmit={handleRedeem}>
        <label className="child-progress__label" htmlFor="parent-code">
          {t('child.codeLabel')}
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
            {busy ? t('child.submitting') : t('child.submit')}
          </Button>
        </div>
        {errorText && <p className="child-progress__error">{errorText}</p>}
        {submitted && (
          <p className="child-progress__status" role="status">
            {t('child.submitted')}
          </p>
        )}
      </form>

      {requests.length > 0 && (
        <ul className="child-progress__requests" aria-label={t('child.requests')}>
          {requests.map((request) => (
            <li
              key={request.id}
              className={
                request.status === 'rejected'
                  ? 'child-progress__request child-progress__request--rejected'
                  : 'child-progress__request'
              }
            >
              {request.status === 'pending'
                ? t('child.requestPending', { date: date(request.created_at) })
                : t('child.requestRejected', { date: date(request.created_at) })}
            </li>
          ))}
        </ul>
      )}

      {children !== null && children.length > 1 && (
        <div className="child-progress__switch" role="group" aria-label={t('child.pick')}>
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
              {child.display_name ?? t('child.noName')}
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          {/*
            Шапка існує лише на папері. Аркуш, що пішов із кабінету, має сам
            казати, про кого він і станом на коли, — інакше через місяць це
            просто стос чисел.
          */}
          <div className="print-only child-progress__print-head">
            <h2>{t('child.reportTitle', { name: active.display_name ?? t('child.noName') })}</h2>
            <p>{t('child.asOf', { date: date(new Date().toISOString()) })}</p>
          </div>

          <div className="child-progress__name-row">
            <h2 className="child-progress__name">{active.display_name ?? t('child.noName')}</h2>
            {rows !== null && totalAttempts > 0 && (
              <div className="child-progress__actions">
                {/*
                  Копія даних дитини — право батьків. Той самий CSV, що й у
                  вчителя (lib/csv.js): одна спроба — один рядок з усіма
                  показниками, відкривається в Excel і Google Таблицях.
                */}
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(
                      csvFileName(active.display_name ?? 'dytyna'),
                      buildGroupCsv({
                        students: [{ id: active.id, displayName: active.display_name ?? 'Без імені' }],
                        results: rows.map((row) => ({ ...row, user_id: active.id })),
                        gameTitles: GAME_TITLES,
                      }),
                    )
                  }
                >
                  {t('child.downloadCsv')}
                </Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  {t('child.print')}
                </Button>
              </div>
            )}
          </div>

          {rows === null && <p>{t('child.loading')}</p>}

          {rows !== null && totalAttempts === 0 && (
            <p className="child-progress__empty">{t('child.empty')}</p>
          )}

          {games !== null && games.length > 0 && (
            <>
              <p className="child-progress__summary">
                {t('child.summary', {
                  count: totalAttempts,
                  games: t(games.length === 1 ? 'child.games.one' : 'child.games.many', {
                    n: games.length,
                  }),
                })}
              </p>
              {t.locale !== 'uk' && (
                <p className="child-progress__lang-note">{t('child.gamesInUkrainian')}</p>
              )}

              <ul className="child-progress__games">
                {games.map((entry) => (
                  <li key={entry.gameId} className="child-progress__game" lang="uk">
                    <div className="child-progress__game-head">
                      <h3>{entry.game.title}</h3>
                      <Badge tone={CATEGORIES[entry.game.category].color}>
                        {t(`category.${entry.game.category}`)}
                      </Badge>
                    </div>

                    <p className="child-progress__game-meta">
                      {t('child.meta', {
                        attempts: entry.history.length,
                        best: entry.best,
                        date: date(entry.last),
                      })}
                    </p>

                    {entry.highlights.length > 0 && (
                      <dl className="child-progress__metrics">
                        {entry.highlights.map(({ key, value }) => (
                          <div key={key}>
                            <dt>
                              <span>{metricLabel(key)}</span>
                              <MetricHelp metric={key} />
                            </dt>
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
                          ? t('child.growthUp', { n: entry.growth })
                          : t('child.growthDown', { n: Math.abs(entry.growth) })}
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
        <p className="child-progress__note">{t('child.studentNote')}</p>
      )}
    </section>
  )
}

export default ChildProgress
