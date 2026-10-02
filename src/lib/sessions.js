import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'
import { normalizeSteps } from '../data/sessionTemplates'

/**
 * Заняття: шаблони фахівця, призначення групі чи дитині, проходження.
 *
 * Бали в проходженні не дублюються: звіт по заняттю бере їх із results за
 * вікном часу проходження (runReport нижче). Друге джерело правди про ту саму
 * спробу рано чи пізно розійшлося б із першим — як і у завдань.
 *
 * Звичайне завдання «зіграй тричі» — це окремий випадок заняття з одного
 * кроку. Завдання лишилися як були (assignments), щоб не ламати вже видані, а
 * конструктор уміє заняття з одного кроку гри.
 */

const TEMPLATE_COLUMNS = 'id, title, steps, max_minutes, break_every_minutes, created_at'
const PLAN_COLUMNS =
  'id, group_id, student_id, kind, title, steps, max_minutes, break_every_minutes, created_at, archived_at'
const RUN_COLUMNS =
  'id, plan_id, student_id, started_at, finished_at, steps_done, adaptations, mood_before, mood_after, reflection'

function planFromRow(row) {
  return { ...row, steps: normalizeSteps(row.steps) }
}

/* ─────────── шаблони фахівця ─────────── */

export async function listMyTemplates() {
  const { data, error } = await supabase
    .from('session_templates')
    .select(TEMPLATE_COLUMNS)
    .order('created_at', { ascending: false })
  if (isMissingTable(error)) return null
  if (error) throw error
  return data.map(planFromRow)
}

export async function saveTemplate({ title, steps, maxMinutes, breakEveryMinutes }) {
  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      title: title.trim(),
      steps: normalizeSteps(steps),
      max_minutes: maxMinutes || null,
      break_every_minutes: breakEveryMinutes || null,
    })
    .select(TEMPLATE_COLUMNS)
    .single()
  if (error) throw error
  return planFromRow(data)
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('session_templates').delete().eq('id', id)
  if (error) throw error
}

/* ─────────── призначення ─────────── */

export async function listGroupPlans(groupId) {
  const { data, error } = await supabase
    .from('session_plans')
    .select(PLAN_COLUMNS)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (isMissingTable(error)) return null
  if (error) throw error
  return data.map(planFromRow)
}

export async function createPlan({
  groupId,
  studentId = null,
  kind = 'session',
  title,
  steps,
  maxMinutes,
  breakEveryMinutes,
}) {
  const { data, error } = await supabase
    .from('session_plans')
    .insert({
      group_id: groupId,
      student_id: studentId || null,
      kind,
      title: title.trim(),
      steps: normalizeSteps(steps),
      max_minutes: maxMinutes || null,
      break_every_minutes: breakEveryMinutes || null,
    })
    .select(PLAN_COLUMNS)
    .single()
  if (error) throw error
  return planFromRow(data)
}

/** «Зняти» — позначка, а не видалення: звіти про проведені заняття лишаються. */
export async function archivePlan(id) {
  const { error } = await supabase
    .from('session_plans')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getPlan(id) {
  const { data, error } = await supabase.from('session_plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? planFromRow(data) : null
}

/**
 * Заняття, які бачить дитина: незняті, для всієї групи або саме для неї
 * (решту відсіє RLS, тут лише архів).
 */
export async function listMyPlans(groupId) {
  if (!groupId) return []
  const { data, error } = await supabase
    .from('session_plans')
    .select(PLAN_COLUMNS)
    .eq('group_id', groupId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (isMissingTable(error)) return []
  if (error) throw error
  return data.map(planFromRow)
}

/* ─────────── проходження ─────────── */

export async function startRun(planId, adaptations) {
  const { data, error } = await supabase
    .from('session_runs')
    .insert({ plan_id: planId, adaptations })
    .select(RUN_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function updateRun(runId, patch) {
  const { error } = await supabase.from('session_runs').update(patch).eq('id', runId)
  if (error) throw error
}

export async function listMyRuns(userId) {
  const { data, error } = await supabase
    .from('session_runs')
    .select(RUN_COLUMNS)
    .eq('student_id', userId)
    .order('started_at', { ascending: false })
  if (isMissingTable(error)) return []
  if (error) throw error
  return data
}

export async function listRunsForPlans(planIds) {
  if (planIds.length === 0) return []
  const { data, error } = await supabase
    .from('session_runs')
    .select(RUN_COLUMNS)
    .in('plan_id', planIds)
    .order('started_at', { ascending: false })
  if (isMissingTable(error)) return []
  if (error) throw error
  return data
}

export async function listRunsForStudent(studentId) {
  const { data, error } = await supabase
    .from('session_runs')
    .select(RUN_COLUMNS)
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
  if (isMissingTable(error)) return []
  if (error) throw error
  return data
}

/* ─────────── звіт ─────────── */

/*
 * Спроба, записана трохи після того, як дитина натиснула «Далі», ще належить
 * кроку: час у results ставить клієнт, і між ним і позначкою кроку бувають
 * секунди.
 */
const SKEW_MS = 60 * 1000

function runWindow(run) {
  const start = new Date(run.started_at).getTime() - SKEW_MS
  const marks = (run.steps_done ?? []).map((mark) => new Date(mark.at).getTime())
  const lastMark = marks.length ? Math.max(...marks) : start
  const end = run.finished_at ? new Date(run.finished_at).getTime() : lastMark
  return { start, end: end + SKEW_MS }
}

/**
 * Звіт по одному проходженню: для кожного кроку — чи пройдено, і для ігор —
 * спроба з results.
 *
 * Спроби дитини в межах вікна заняття роздаються ігровим крокам по черзі: у
 * занятті може бути та сама гра двічі, і кожен крок має отримати свою спробу.
 *
 * @param plan    { steps }
 * @param run     { started_at, finished_at, steps_done: [{ i, at, skipped? }] }
 * @param results спроби цієї дитини: { game_id, score, metrics, played_at }
 */
export function runReport(plan, run, results) {
  const { start, end } = runWindow(run)
  const inWindow = results
    .filter((result) => {
      const at = new Date(result.played_at).getTime()
      return at >= start && at <= end
    })
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at))

  const used = new Set()
  const marks = new Map((run.steps_done ?? []).map((mark) => [mark.i, mark]))

  const steps = plan.steps.map((step, index) => {
    const mark = marks.get(index)
    const status = !mark ? 'pending' : mark.skipped ? 'skipped' : 'done'
    if (step.kind !== 'game') return { step, index, status }

    const attemptIndex = inWindow.findIndex(
      (result, i) => !used.has(i) && result.game_id === step.gameId,
    )
    if (attemptIndex === -1) return { step, index, status, attempt: null }
    used.add(attemptIndex)
    return { step, index, status, attempt: inWindow[attemptIndex] }
  })

  const done = steps.filter((item) => item.status === 'done').length
  const minutes = run.finished_at
    ? Math.max(1, Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 60000))
    : null

  return { steps, done, total: plan.steps.length, finished: Boolean(run.finished_at), minutes }
}

/**
 * Зріз «до/після»: усі завершені проходження батареї однієї дитини, від
 * найстаршого, з балами й показниками кожної гри.
 *
 * `sameConditions` — чи профіль адаптацій у кожному зрізі той самий, що в
 * першому. Якщо ні, порівняння вже не чисте, і фахівець має про це знати.
 */
export function batterySlices(plans, runs, results) {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]))
  const slices = runs
    .filter((run) => run.finished_at && plansById.get(run.plan_id)?.kind === 'battery')
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    .map((run) => {
      const plan = plansById.get(run.plan_id)
      const report = runReport(plan, run, results)
      const byGame = {}
      for (const item of report.steps) {
        if (item.attempt) {
          byGame[item.step.gameId] = { score: item.attempt.score, metrics: item.attempt.metrics ?? {} }
        }
      }
      return { runId: run.id, date: run.started_at, byGame, adaptations: run.adaptations ?? null }
    })

  const first = JSON.stringify(slices[0]?.adaptations ?? null)
  const sameConditions = slices.every((slice) => JSON.stringify(slice.adaptations ?? null) === first)
  return { slices, sameConditions }
}

/** Коли радять наступний зріз: через 4–6 тижнів після останнього. */
export function nextBatteryWindow(slices, weeks = { min: 4, max: 6 }) {
  const last = slices.at(-1)
  if (!last) return null
  const from = new Date(last.date)
  const day = 24 * 60 * 60 * 1000
  return {
    from: new Date(from.getTime() + weeks.min * 7 * day),
    to: new Date(from.getTime() + weeks.max * 7 * day),
  }
}
