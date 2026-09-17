import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Trophy,
  Medal,
  Award,
  Download,
  Pencil,
  UserMinus,
  Check,
  X,
  Copy,
  UserRoundPlus,
  Printer,
} from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { getGroupDetails, renameStudent, removeStudentFromGroup } from '../lib/groups'
import { buildGroupCsv, csvFileName, downloadCsv } from '../lib/csv'
import ParentAccess from '../components/teacher/ParentAccess'
import GameBreakdown from '../components/teacher/GameBreakdown'
import Assignments from '../components/teacher/Assignments'
import { GAMES } from '../data/games'
import './GroupDetail.css'

const RANK_ICONS = [Trophy, Medal, Award]

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

/* На папері дата має бути повною: «15 вер.» через півроку нічого не означає. */
function formatFullDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function GroupDetail() {
  const { groupId } = useParams()
  const { user, loading } = useAuth()
  const [data, setData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [accessFor, setAccessFor] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false
    getGroupDetails(groupId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Групу не знайдено або в тебе немає до неї доступу.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, groupId])

  async function reload() {
    setData(await getGroupDetails(groupId))
  }

  async function handleRename(studentId) {
    const name = draftName.trim()
    if (!name) return

    setBusyId(studentId)
    setActionError(null)
    try {
      await renameStudent(studentId, name)
      setEditingId(null)
      await reload()
    } catch {
      setActionError('Не вдалося перейменувати. Спробуй ще раз.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(student) {
    // Confirmed because it's not obvious from the button that the child keeps
    // their account and history and only leaves this group.
    const confirmed = window.confirm(
      `Прибрати «${student.displayName}» з групи? Результати збережуться, учень зможе приєднатися знову за кодом.`,
    )
    if (!confirmed) return

    setBusyId(student.id)
    setActionError(null)
    try {
      await removeStudentFromGroup(student.id)
      await reload()
    } catch {
      setActionError('Не вдалося прибрати учня. Спробуй ще раз.')
    } finally {
      setBusyId(null)
    }
  }

  if (!isCloudConfigured) {
    return (
      <section className="group-detail">
        <h1>Група</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="group-detail">
        <h1>Група</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="group-detail">
        <h1>Група</h1>
        <p>Спершу увійди на сторінці входу.</p>
        <Link to="/login">До входу</Link>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="group-detail">
        <h1>Група</h1>
        <p className="group-detail__error">{errorMessage}</p>
        <Link to="/groups">← До моїх груп</Link>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="group-detail">
        <h1>Група</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  const joinUrl = `${window.location.host}/join`

  return (
    <section className="group-detail">
      <Link to="/groups" className="group-detail__back">
        ← До моїх груп
      </Link>
      <h1>{data.group.name}</h1>

      {/*
        Шапка існує лише на папері. Аркуш, що пішов із кабінету, має сам казати,
        про яку групу він і станом на коли, — інакше через місяць це просто стос
        чисел. Код приєднання сюди навмисно не потрапляє: він відкриває вхід у
        групу, а роздрукований звіт лишають на столах і в теках.
      */}
      <div className="print-only group-detail__print-head">
        <p>
          Звіт про заняття · {formatFullDate(new Date().toISOString())} · Inclusive Games
        </p>
      </div>

      {/* Код — головне, що вчителю треба з цієї сторінки на уроці: його
          диктують класу або показують з екрана. Раніше він лежав дрібним
          рядком усередині речення. */}
      <div className="group-detail__join">
        <div className="group-detail__join-code">
          <span className="group-detail__join-label">Код для приєднання</span>
          <strong className="group-detail__code">{data.group.join_code}</strong>
        </div>
        <div className="group-detail__join-side">
          <p className="group-detail__join-where">
            Діти відкривають <code>{joinUrl}</code> і вводять цей код.
          </p>
          <button
            type="button"
            className="group-detail__copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${joinUrl} — код ${data.group.join_code}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              } catch {
                // Буфер може бути недоступний (немає дозволу, старий браузер) —
                // код видно на екрані, тож це не привід показувати помилку.
                setCopied(false)
              }
            }}
          >
            <Copy size={16} aria-hidden="true" />
            {copied ? 'Скопійовано' : 'Скопіювати адресу й код'}
          </button>
        </div>
      </div>

      {data.students.length > 0 && (
        <button
          type="button"
          className="group-detail__export"
          onClick={() =>
            downloadCsv(
              csvFileName(data.group.name),
              buildGroupCsv({
                students: data.students,
                results: data.results ?? [],
                gameTitles: GAME_TITLES,
              }),
            )
          }
        >
          <Download size={16} aria-hidden="true" />
          Експортувати CSV
        </button>
      )}

      {data.students.length > 0 && (
        <button type="button" className="group-detail__export" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Друкувати звіт
        </button>
      )}

      <Assignments
        groupId={groupId}
        students={data.students}
        results={data.results ?? []}
      />

      {data.students.length > 0 && (
        <GameBreakdown results={data.results ?? []} students={data.students} />
      )}

      {data.students.length === 0 ? (
        <p className="group-detail__empty">
          До цієї групи ще ніхто не приєднався. Щойно перша дитина введе код,
          тут зʼявиться список із балами й кнопка вивантаження в таблицю.
        </p>
      ) : (
        <>
          {(() => {
            const ranked = data.students
              .filter((student) => student.attempts > 0)
              .sort((a, b) => b.avgScore - a.avgScore)
              .slice(0, 5)

            if (ranked.length === 0) return null

            return (
              <div className="group-detail__leaderboard">
                <h2>Рейтинг групи</h2>
                <ol className="group-detail__leaderboard-list">
                  {ranked.map((student, index) => {
                    const RankIcon = RANK_ICONS[index]
                    return (
                      <li key={student.id} className="group-detail__leaderboard-item">
                        <span className="group-detail__leaderboard-rank">
                          {RankIcon ? (
                            <RankIcon size={18} aria-hidden="true" />
                          ) : (
                            <span className="group-detail__leaderboard-rank-num">{index + 1}</span>
                          )}
                        </span>
                        <span className="group-detail__leaderboard-name">{student.displayName}</span>
                        <span className="group-detail__leaderboard-score">{student.avgScore}%</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })()}

          {actionError && <p className="group-detail__error">{actionError}</p>}

          {accessFor && (
            <ParentAccess student={accessFor} onClose={() => setAccessFor(null)} />
          )}

          <div className="group-detail__table-wrap">
          <table className="group-detail__table">
            <thead>
              <tr>
                <th>Учень</th>
                <th>Приєднався</th>
                <th>Спроб</th>
                <th>Середній бал</th>
                <th>Остання гра</th>
                <th aria-label="Дії" />
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td data-label="Учень" className="group-detail__cell-name">
                    {editingId === student.id ? (
                      <input
                        className="group-detail__name-input"
                        aria-label={`Нове ім'я для ${student.displayName}`}
                        value={draftName}
                        autoFocus
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleRename(student.id)
                          if (event.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      student.displayName
                    )}
                  </td>
                  <td data-label="Приєднався">{formatDate(student.joinedAt)}</td>
                  <td data-label="Спроб">{student.attempts}</td>
                  <td data-label="Середній бал">{student.avgScore ?? '—'}</td>
                  <td data-label="Остання гра">{formatDate(student.lastPlayed)}</td>
                  <td className="group-detail__cell-actions">
                    <div className="group-detail__row-actions">
                      {editingId === student.id ? (
                        <>
                          <button
                            type="button"
                            className="group-detail__icon-btn"
                            aria-label="Зберегти ім'я"
                            disabled={busyId === student.id || !draftName.trim()}
                            onClick={() => handleRename(student.id)}
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="group-detail__icon-btn"
                            aria-label="Скасувати"
                            onClick={() => setEditingId(null)}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="group-detail__icon-btn"
                            aria-label={`Перейменувати ${student.displayName}`}
                            disabled={busyId === student.id}
                            onClick={() => {
                              setEditingId(student.id)
                              setDraftName(student.displayName)
                              setActionError(null)
                            }}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="group-detail__icon-btn"
                            aria-label={`Доступ батьків: ${student.displayName}`}
                            disabled={busyId === student.id}
                            onClick={() => setAccessFor(student)}
                          >
                            <UserRoundPlus size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="group-detail__icon-btn group-detail__icon-btn--danger"
                            aria-label={`Прибрати ${student.displayName} з групи`}
                            disabled={busyId === student.id}
                            onClick={() => handleRemove(student)}
                          >
                            <UserMinus size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  )
}

export default GroupDetail
