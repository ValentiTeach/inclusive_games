import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Star } from 'lucide-react'
import AchievementBadge from './AchievementBadge'

const achievement = { id: 'x', title: 'Значок', description: 'Опис', icon: Star }

describe('значок досягнення', () => {
  it('показує, скільки лишилось, поки не здобуто', () => {
    render(
      <AchievementBadge
        achievement={achievement}
        progress={{ current: 3, target: 10, unlocked: false }}
      />,
    )

    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('10')
    expect(screen.getByText('3 / 10')).toBeTruthy()
  })

  it('здобутий значок смужки не показує', () => {
    render(
      <AchievementBadge
        achievement={achievement}
        progress={{ current: 10, target: 10, unlocked: true }}
      />,
    )

    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('ціль в одну спробу смужки не потребує', () => {
    render(
      <AchievementBadge
        achievement={achievement}
        progress={{ current: 0, target: 1, unlocked: false }}
      />,
    )

    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  /**
   * Значок показують у трьох місцях, і забутий проп коштував білого екрана саме
   * на екрані результатів — там, де дитина бачить нагороду.
   */
  it('без прогресу не падає, а лишається значком', () => {
    render(<AchievementBadge achievement={achievement} />)

    expect(screen.getByText('Значок')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
