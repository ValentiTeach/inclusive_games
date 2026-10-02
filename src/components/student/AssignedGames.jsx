import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ClipboardList } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { supabase, isCloudConfigured } from '../../lib/supabaseClient'
import { GAMES } from '../../data/games'
import { isOverdue, listAssignments, openAssignments } from '../../lib/assignments'
import { listMyPlans, listMyRuns } from '../../lib/sessions'
import './AssignedGames.css'

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

function formatDue(assignment) {
  if (isOverdue(assignment)) return 'строк минув'
  const date = new Date(assignment.due_on)
  return `до ${date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`
}

/**
 * Що задав учитель — на видноті в дитини, просто над каталогом.
 *
 * Показуються лише невиконані завдання: список, у якому половина пунктів уже
 * закреслена, читається як докір, а не як підказка, що робити далі.
 */
function AssignedGames() {
  const { user, profile } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [plans, setPlans] = useState([])

  const groupId = profile?.group_id ?? null

  useEffect(() => {
    if (!isCloudConfigured || !user || !groupId) return undefined

    let cancelled = false

    async function load() {
      const list = await listAssignments(groupId)
      // null — таблиці ще немає: міграція не застосована, і показувати нічого.
      if (!list || list.length === 0) return

      const { data: mine } = await supabase
        .from('results')
        .select('user_id, game_id, level_id, played_at')
        .eq('user_id', user.id)

      if (!cancelled) setAssignments(openAssignments(list, mine ?? [], user.id))
    }

    /*
     * Заняття, які дитина ще не завершила. Завершене зникає з цього списку, як
     * і виконане завдання; зріз «до/після» — так само, до наступного.
     */
    async function loadPlans() {
      const [list, runs] = await Promise.all([listMyPlans(groupId), listMyRuns(user.id)])
      const finished = new Set(runs.filter((run) => run.finished_at).map((run) => run.plan_id))
      if (!cancelled) setPlans(list.filter((plan) => !finished.has(plan.id)))
    }

    loadPlans().catch(() => {})

    load().catch(() => {
      // Тиха невдача навмисно: це підказка збоку, а не головний вміст сторінки.
      // Помилка мережі тут не має заступати каталог ігор.
    })

    return () => {
      cancelled = true
    }
  }, [user, groupId])

  if (assignments.length === 0 && plans.length === 0) return null

  return (
    <>
      {plans.length > 0 && (
        <section className="assigned">
          <h2 className="assigned__title">
            <CalendarCheck size={18} aria-hidden="true" />
            Заняття від учителя
          </h2>
          <ul className="assigned__list">
            {plans.map((plan) => (
              <li key={plan.id} className="assigned__item">
                <Link to={`/session/${plan.id}`} className="assigned__link">
                  {plan.title}
                </Link>
                <span className="assigned__meta">
                  {plan.steps.length} {plan.steps.length < 5 ? 'кроки' : 'кроків'}
                  {plan.max_minutes ? ` · до ${plan.max_minutes} хв` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {assignments.length > 0 && (
        <section className="assigned">
          <h2 className="assigned__title">
            <ClipboardList size={18} aria-hidden="true" />
            Завдання від учителя
          </h2>
          <ul className="assigned__list">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="assigned__item">
                <Link to={`/games/${assignment.game_id}`} className="assigned__link">
                  {GAME_TITLES[assignment.game_id] ?? assignment.game_id}
                </Link>
                <span className="assigned__meta">
                  {assignment.target_attempts > 1
                    ? `${assignment.target_attempts} рази`
                    : 'один раз'}
                  {assignment.due_on && (
                    <span
                      className={
                        isOverdue(assignment) ? 'assigned__due is-overdue' : 'assigned__due'
                      }
                    >
                      {' · '}
                      {formatDue(assignment)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

export default AssignedGames
