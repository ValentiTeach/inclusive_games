import { describe, it, expect } from 'vitest'
import { CARDS, config, expectedTarget, nextHiddenRule, ruleAt, scoring } from './cardSort.config'

const [oneSwitch, blocks, border] = config.levels

describe('правила', () => {
  it('блоки починаються з кольору й чергуються', () => {
    expect([0, 4, 5, 9].map((i) => ruleAt(oneSwitch, i))).toEqual(['color', 'color', 'shape', 'shape'])
    expect([0, 4, 8, 12].map((i) => ruleAt(blocks, i))).toEqual(['color', 'shape', 'color', 'shape'])
  })

  it('з рамкою — за формою, без рамки — за кольором', () => {
    expect(ruleAt(border, 0, true)).toBe('shape')
    expect(ruleAt(border, 0, false)).toBe('color')
  })

  /*
   * Суть гри: кожна картка за одним правилом іде в один кошик, за іншим — в
   * інший. Якби хоч одна картка йшла в той самий кошик за обома правилами,
   * перемикання на ній не перевірялось би.
   */
  it('кожна картка конфліктує: за кольором і за формою — різні кошики', () => {
    for (const card of CARDS) {
      expect(expectedTarget({ card, rule: 'color' })).not.toBe(expectedTarget({ card, rule: 'shape' }))
    }
  })
})

describe('показники', () => {
  it('рахує помилки одразу після зміни і помилки за старим правилом', () => {
    const { metrics } = scoring([
      { correct: true, rule: 'color', switched: false, afterSwitch: false },
      { correct: false, rule: 'shape', switched: true, afterSwitch: true },
      { correct: false, rule: 'shape', switched: false, afterSwitch: true },
      { correct: true, rule: 'color', switched: true, afterSwitch: true },
    ])
    expect(metrics).toMatchObject({ switch_trials: 2, switch_errors: 1, perseverations: 2 })
  })

  it('у грі з рамкою «за старим правилом» не рахується — старого правила там немає', () => {
    const { metrics } = scoring([
      { correct: true, rule: 'color', switched: false },
      { correct: false, rule: 'shape', switched: true },
    ])
    expect(metrics.perseverations).toBeUndefined()
    expect(metrics.switch_errors).toBe(1)
  })
})

describe('прихована зміна правила', () => {
  const hidden = config.levels.find((level) => level.mode === 'hidden')

  it('правило змінюється лише після серії правильних відповідей', () => {
    expect(nextHiddenRule('color', hidden.streak - 1, hidden)).toBe('color')
    expect(nextHiddenRule('color', hidden.streak, hidden)).toBe('shape')
    expect(nextHiddenRule('shape', hidden.streak, hidden)).toBe('color')
  })

  it('у прихованому режимі правило бере те, яке веде поле', () => {
    expect(ruleAt(hidden, 0, false, 'shape')).toBe('shape')
  })
})
