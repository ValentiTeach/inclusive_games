import { describe, it, expect } from 'vitest'
import { METRIC_LABELS } from '../games/engine/metrics'
import { METRIC_HELP } from './metricHelp'

describe('пояснення показників', () => {
  // Перейменований показник лишив би пояснення сиротою, а «?» у звіті — без
  // підказки, і ніхто б не помітив.
  it('пояснює лише показники, які справді існують', () => {
    for (const key of Object.keys(METRIC_HELP)) {
      expect(METRIC_LABELS, key).toHaveProperty(key)
    }
  })

  /*
   * Саме ці числа вчителі й батьки бачать без пояснення і не можуть
   * прочитати: розкид, втома, імпульсивність, «застрягання». Новий показник
   * такого роду має приходити разом з поясненням.
   */
  it('пояснює все, що не говорить само за себе', () => {
    for (const key of [
      'accuracy_pct',
      'avg_rt_ms',
      'rt_sd_ms',
      'rt_cv_pct',
      'accuracy_first_half_pct',
      'accuracy_second_half_pct',
      'post_error_slowing_ms',
      'perseverations',
      'conflict_ms',
      'false_alarms',
      'planning_ms',
      'time_bias_pct',
      'mirror_errors',
      'lure_errors',
      'relaxed_pace',
      'battery',
    ]) {
      expect(METRIC_HELP[key]?.short, key).toBeTruthy()
    }
  })

  it('коротка підказка — одне речення, що влазить у спливну підказку', () => {
    for (const [key, help] of Object.entries(METRIC_HELP)) {
      expect(help.short.length, key).toBeLessThanOrEqual(110)
      expect(help.short.trim().endsWith('.'), key).toBe(true)
    }
  })
})
