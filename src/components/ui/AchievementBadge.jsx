import './AchievementBadge.css'

/**
 * Значок показує не лише «є / немає», а й скільки лишилось.
 *
 * Досі замкнений значок був просто блідим: дитина бачила, що чогось не має, але
 * не знала ні скільки треба, ні наскільки вона близько. Смужка під назвою
 * відповідає на обидва питання й перетворює значок із докору на ціль.
 */
function AchievementBadge({ achievement, progress }) {
  const Icon = achievement.icon
  /*
   * Значок показують у трьох місцях, і забути проп тут коштувало білого екрана
   * саме на екрані результатів — там, де дитина бачить нагороду. Тепер
   * відсутній прогрес означає «просто значок», а не падіння сторінки.
   */
  const { current = 0, target = 1, unlocked = false } = progress ?? {}
  const className = unlocked
    ? 'achievement-badge achievement-badge--unlocked'
    : 'achievement-badge achievement-badge--locked'

  return (
    <div className={className} title={achievement.description}>
      <Icon className="achievement-badge__icon" aria-hidden="true" />
      <span className="achievement-badge__title">{achievement.title}</span>

      {/*
        Значок із ціллю в одну спробу не має чого показувати: смужка «0 з 1»
        нічого не додає до самого значка.
      */}
      {!unlocked && target > 1 && (
        <>
          <span
            className="achievement-badge__bar"
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`${achievement.title}: ${current} з ${target}`}
          >
            <span
              className="achievement-badge__bar-fill"
              style={{ width: `${(current / target) * 100}%` }}
            />
          </span>
          <span className="achievement-badge__count">
            {current} / {target}
          </span>
        </>
      )}
    </div>
  )
}

export default AchievementBadge
