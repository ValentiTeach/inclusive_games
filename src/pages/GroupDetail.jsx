import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, Medal, Award, Download } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { getGroupDetails } from '../lib/groups'
import { buildGroupCsv, csvFileName, downloadCsv } from '../lib/csv'
import { GAMES } from '../data/games'
import './GroupDetail.css'

const RANK_ICONS = [Trophy, Medal, Award]

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

function GroupDetail() {
  const { groupId } = useParams()
  const { user, loading } = useAuth()
  const [data, setData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

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

  return (
    <section className="group-detail">
      <Link to="/groups" className="group-detail__back">
        ← До моїх груп
      </Link>
      <h1>{data.group.name}</h1>
      <p>
        Код для приєднання: <span className="group-detail__code">{data.group.join_code}</span>
      </p>

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

      {data.students.length === 0 ? (
        <p>До цієї групи ще ніхто не приєднався.</p>
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

          <div className="group-detail__table-wrap">
          <table className="group-detail__table">
            <thead>
              <tr>
                <th>Учень</th>
                <th>Приєднався</th>
                <th>Спроб</th>
                <th>Середній бал</th>
                <th>Остання гра</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.displayName}</td>
                  <td>{formatDate(student.joinedAt)}</td>
                  <td>{student.attempts}</td>
                  <td>{student.avgScore ?? '—'}</td>
                  <td>{formatDate(student.lastPlayed)}</td>
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
