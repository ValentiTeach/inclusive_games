import './AchievementBadge.css'

function AchievementBadge({ achievement, unlocked }) {
  const Icon = achievement.icon
  const className = unlocked
    ? 'achievement-badge achievement-badge--unlocked'
    : 'achievement-badge achievement-badge--locked'

  return (
    <div className={className} title={achievement.description}>
      <Icon className="achievement-badge__icon" aria-hidden="true" />
      <span className="achievement-badge__title">{achievement.title}</span>
    </div>
  )
}

export default AchievementBadge
