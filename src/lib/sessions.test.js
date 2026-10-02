import { describe, it, expect } from 'vitest'
import { batterySlices, nextBatteryWindow, runReport } from './sessions'
import {
  BATTERY,
  TEMPLATE_LIBRARY,
  normalizeSteps,
} from '../data/sessionTemplates'
import { GAME_REGISTRY } from '../games/registry'

const plan = {
  id: 'p1',
  kind: 'session',
  steps: [
    { kind: 'greeting' },
    { kind: 'game', gameId: 'schulte' },
    { kind: 'movement', seconds: 40 },
    { kind: 'game', gameId: 'schulte' },
    { kind: 'game', gameId: 'stroop' },
    { kind: 'reflection' },
  ],
}

const run = {
  id: 'r1',
  plan_id: 'p1',
  started_at: '2026-10-01T09:00:00Z',
  finished_at: '2026-10-01T09:20:00Z',
  steps_done: [
    { i: 0, at: '2026-10-01T09:01:00Z' },
    { i: 1, at: '2026-10-01T09:05:00Z' },
    { i: 2, at: '2026-10-01T09:06:00Z' },
    { i: 3, at: '2026-10-01T09:10:00Z' },
    { i: 4, at: '2026-10-01T09:11:00Z', skipped: true },
    { i: 5, at: '2026-10-01T09:20:00Z' },
  ],
}

const result = (game_id, played_at, score) => ({ game_id, played_at, score, metrics: {} })

describe('runReport', () => {
  it('hands each game step its own attempt, in order', () => {
    const report = runReport(plan, run, [
      result('schulte', '2026-10-01T09:09:00Z', 70),
      result('schulte', '2026-10-01T09:04:00Z', 60),
      // До заняття й після нього — не рахується.
      result('schulte', '2026-09-30T09:04:00Z', 99),
      result('schulte', '2026-10-01T11:00:00Z', 99),
    ])
    expect(report.steps[1].attempt.score).toBe(60)
    expect(report.steps[3].attempt.score).toBe(70)
    expect(report.steps[4].status).toBe('skipped')
    expect(report.steps[4].attempt).toBeNull()
    expect(report.done).toBe(5)
    expect(report.minutes).toBe(20)
  })

  it('an unfinished run is reported as such', () => {
    const report = runReport(plan, { ...run, finished_at: null, steps_done: run.steps_done.slice(0, 2) }, [])
    expect(report.finished).toBe(false)
    expect(report.steps[3].status).toBe('pending')
    expect(report.minutes).toBeNull()
  })
})

describe('battery', () => {
  const batteryPlan = { id: 'b', kind: 'battery', steps: BATTERY.steps }
  const finishedRun = (id, day, adaptations = null) => ({
    id,
    plan_id: 'b',
    started_at: `2026-${day}T09:00:00Z`,
    finished_at: `2026-${day}T09:12:00Z`,
    steps_done: [],
    adaptations,
  })

  it('collects slices oldest first and flags changed conditions', () => {
    const runs = [finishedRun('r2', '11-10', { holdMs: 500 }), finishedRun('r1', '10-01')]
    const results = [
      { game_id: 'schulte', score: 40, metrics: { errors: 3 }, played_at: '2026-10-01T09:03:00Z' },
      { game_id: 'schulte', score: 55, metrics: { errors: 1 }, played_at: '2026-11-10T09:03:00Z' },
    ]
    const { slices, sameConditions } = batterySlices([batteryPlan], runs, results)
    expect(slices.map((slice) => slice.runId)).toEqual(['r1', 'r2'])
    expect(slices[1].byGame.schulte.score).toBe(55)
    expect(sameConditions).toBe(false)
  })

  it('suggests the next slice 4–6 weeks later', () => {
    const window = nextBatteryWindow([{ date: '2026-10-01T09:00:00Z' }])
    expect(Math.round((window.from - new Date('2026-10-01T09:00:00Z')) / 86400000)).toBe(28)
    expect(Math.round((window.to - new Date('2026-10-01T09:00:00Z')) / 86400000)).toBe(42)
  })

  it('uses fixed levels that exist in every game', () => {
    for (const step of BATTERY.steps.filter((item) => item.kind === 'game')) {
      expect(step.levelId, step.gameId).toBeTruthy()
      const levels = GAME_REGISTRY[step.gameId].config.levels.map((level) => level.id)
      expect(levels, step.gameId).toContain(step.levelId)
    }
  })
})

describe('template library', () => {
  it('every template refers to real games and levels and survives normalisation', () => {
    for (const template of TEMPLATE_LIBRARY) {
      expect(normalizeSteps(template.steps)).toEqual(template.steps)
      for (const step of template.steps.filter((item) => item.kind === 'game')) {
        const entry = GAME_REGISTRY[step.gameId]
        expect(entry, step.gameId).toBeTruthy()
        if (step.levelId) {
          expect(entry.config.levels.map((level) => level.id)).toContain(step.levelId)
        }
      }
    }
  })

  it('normalisation drops unknown steps and clamps durations', () => {
    expect(
      normalizeSteps([
        { kind: 'video', url: 'x' },
        { kind: 'game', gameId: 'no-such-game' },
        { kind: 'breathing', seconds: 9999 },
        { kind: 'movement', seconds: 'abc' },
      ]),
    ).toEqual([
      { kind: 'breathing', seconds: 180 },
      { kind: 'movement', seconds: 40 },
    ])
  })
})
