import { AVATARS } from '../../data/avatars'
import './AvatarPicker.css'

/**
 * Сітка тваринок. Великі цілі (від 64 px): обирає дитина, часто пальцем і
 * часто ще не читаючи — тож назва тваринки є і для читача екрана, і як
 * підказка під емодзі.
 */
function AvatarPicker({ value, onPick, disabled = false }) {
  return (
    <div className="avatar-picker" role="group" aria-label="Обери тваринку">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.key}
          type="button"
          className="avatar-picker__option"
          aria-pressed={value === avatar.key}
          disabled={disabled}
          onClick={() => onPick(avatar.key)}
        >
          <span className="avatar-picker__emoji" aria-hidden="true">
            {avatar.emoji}
          </span>
          <span className="avatar-picker__label">{avatar.label}</span>
        </button>
      ))}
    </div>
  )
}

export default AvatarPicker
