import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Маніфест — не код, і жоден інший тест його не читає. Помилка в ньому не
 * ламає нічого видимого: застосунок працює, просто телефон пропонує «додати
 * ярлик» замість «встановити», і ніхто не помічає роками.
 */
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))

describe('маніфест застосунку', () => {
  it('має все, чого вимагає встановлення', () => {
    for (const field of [
      'id',
      'name',
      'short_name',
      'description',
      'start_url',
      'scope',
      'display',
      'background_color',
      'theme_color',
      'icons',
    ]) {
      expect(manifest[field], field).toBeTruthy()
    }
  })

  /*
   * Під іконкою на телефоні вміщується близько дванадцяти символів. Довша
   * назва обрізається, і застосунок підписаний обрубком.
   */
  it('коротка назва справді коротка', () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
  })

  it('має категорії — за ними застосунок знаходять', () => {
    expect(manifest.categories).toContain('education')
    expect(manifest.categories.length).toBeGreaterThan(0)
  })

  it('усі файли, на які він посилається, існують', () => {
    const paths = [
      ...manifest.icons.map((icon) => icon.src),
      ...manifest.screenshots.map((shot) => shot.src),
      ...manifest.shortcuts.flatMap((item) => item.icons.map((icon) => icon.src)),
    ]

    for (const path of paths) {
      expect(existsSync(`public${path}`), path).toBe(true)
    }
  })

  /**
   * Знімки потрібні обох форм: без «narrow» телефон показує звичайне
   * «додати на головний екран», без «wide» комп'ютер не дає докладного вікна.
   */
  it('має знімки і для телефона, і для широкого екрана', () => {
    const forms = manifest.screenshots.map((shot) => shot.form_factor)

    expect(forms).toContain('narrow')
    expect(forms).toContain('wide')
  })

  it('кожен знімок описаний повністю', () => {
    for (const shot of manifest.screenshots) {
      expect(shot.sizes, shot.src).toMatch(/^\d+x\d+$/)
      expect(shot.type, shot.src).toBeTruthy()
      expect(shot.label, shot.src).toBeTruthy()
    }
  })

  /**
   * Найтихіша з можливих помилок: оголосити маскованою ту саму іконку, що й
   * звичайну. Android зріже їй краї під маску, і ніхто не дізнається — саме
   * так тут і було.
   */
  it('маскована іконка — окремий файл, а не та сама', () => {
    const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable')
    const plain = manifest.icons.filter((icon) => icon.purpose !== 'maskable')

    expect(maskable.length).toBeGreaterThan(0)
    for (const icon of maskable) {
      expect(plain.map((other) => other.src)).not.toContain(icon.src)
    }
  })
})
