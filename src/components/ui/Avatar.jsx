import { avatarOf } from '../../data/avatars'
import './Avatar.css'

/**
 * Тваринка дитини поруч з іменем. Без тваринки нічого не малює: порожній
 * кружечок біля кожного рядка лише додав би шуму.
 */
function Avatar({ avatarKey, size = 'md' }) {
  const avatar = avatarOf(avatarKey)
  if (!avatar) return null
  return (
    <span className={`avatar avatar--${size}`} role="img" aria-label={avatar.label} title={avatar.label}>
      {avatar.emoji}
    </span>
  )
}

export default Avatar
