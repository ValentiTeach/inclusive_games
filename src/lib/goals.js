import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'
import { isLowerBetter, metricLabel } from '../games/engine/metrics'
import { GAMES } from '../data/games'
import { localDay } from './day'

/**
 * Цілі ІПР з прив'язкою до метрик: «до грудня утримує 5 елементів у Саймоні».
 *
 * «Утримує» — ключове слово. Одна вдала спроба — це ще не навичка, тож поточне
 * значення — медіана трьох останніх спроб після постановки цілі, а не рекорд.
 * Рекорд показується поруч, окремо: видно і те, що вже бувало, і те, що стало
 * стабільним.
 */

const GOAL_COLUMNS =
  'id, student_id, game_id, level_id, metric, target, direction, due_on, note, created_at, closed_at'

const GAME_TITLES = Object.fromEntries(GAMES.map((game) => [game.id, game.title]))

const STABLE_OVER = 3

export async function listGoals(studentId) {
  const { data, error } = await supabase
    .from('ipr_goals')
    .select(GOAL_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
  if (isMissingTable(error)) return null
  if (error) throw error
  return data
}

export async function createGoal({ studentId, gameId, levelId, metric, target, dueOn, note }) {
  const { data, error } = await supabase
    .from('ipr_goals')
    .insert({
      student_id: studentId,
      game_id: gameId,
      level_id: levelId || null,
      metric,
      target: Number(target),
      direction: isLowerBetter(metric) ? 'at_most' : 'at_least',
      due_on: dueOn || null,
      note: note || null,
    })
    .select(GOAL_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function closeGoal(id) {
  const { error } = await supabase
    .from('ipr_goals')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('ipr_goals').delete().eq('id', id)
  if (error) throw error
}

export function goalMetricLabel(metric) {
  return metric === 'score' ? 'Бал' : metricLabel(metric)
}

export function goalTitle(goal) {
  const sign = goal.direction === 'at_most' ? '≤' : '≥'
  const game = GAME_TITLES[goal.game_id] ?? goal.game_id
  const due = goal.due_on
    ? `до ${new Date(goal.due_on).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}: `
    : ''
  return `${due}${goalMetricLabel(goal.metric)} ${sign} ${goal.target} у грі «${game}»`
}

function valueOf(result, metric) {
  const value = metric === 'score' ? result.score : result.metrics?.[metric]
  return Number.isFinite(value) ? value : null
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function meets(goal, value) {
  return goal.direction === 'at_most' ? value <= goal.target : value >= goal.target
}

/**
 * Скільки лишилося до цілі.
 *
 * @param results спроби дитини: { game_id, level_id, score, metrics, played_at }
 */
export function goalProgress(goal, results, today = new Date()) {
  const relevant = results
    .filter((result) => result.game_id === goal.game_id)
    .filter((result) => !goal.level_id || result.level_id === goal.level_id)
    .filter((result) => result.played_at >= goal.created_at)
    .sort((a, b) => (a.played_at < b.played_at ? 1 : -1))
    .map((result) => valueOf(result, goal.metric))
    .filter((value) => value !== null)

  const current = relevant.length ? median(relevant.slice(0, STABLE_OVER)) : null
  const best = relevant.length
    ? goal.direction === 'at_most'
      ? Math.min(...relevant)
      : Math.max(...relevant)
    : null

  const achieved = current !== null && meets(goal, current)
  const remaining =
    current === null ? null : Math.max(0, goal.direction === 'at_most' ? current - goal.target : goal.target - current)

  let daysLeft = null
  if (goal.due_on) {
    const due = new Date(`${goal.due_on}T00:00:00`)
    const start = new Date(`${localDay(today)}T00:00:00`)
    daysLeft = Math.round((due - start) / (24 * 60 * 60 * 1000))
  }

  return {
    attempts: relevant.length,
    current,
    best,
    achieved,
    // Ціль, досягнута на одній спробі, ще не «утримується».
    stable: relevant.length >= STABLE_OVER,
    remaining,
    daysLeft,
  }
}

const FALLBACK_METRICS = ['score', 'accuracy_pct', 'correct', 'span', 'rounds_completed', 'avg_rt_ms', 'errors']

/**
 * Показники, з яких можна вибрати ціль для гри: те, що ця гра справді міряла
 * в спробах дитини (бал завжди є). Якщо спроб ще немає — загальний список.
 */
export function metricOptions(gameId, results) {
  const keys = new Set(['score'])
  for (const result of results) {
    if (result.game_id !== gameId) continue
    for (const [key, value] of Object.entries(result.metrics ?? {})) {
      if (Number.isFinite(value)) keys.add(key)
    }
  }
  return keys.size > 1 ? [...keys] : FALLBACK_METRICS
}
