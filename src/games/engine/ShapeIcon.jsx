import { gameColor } from '../../lib/palette'
import './ShapeIcon.css'

function ShapeIcon({ shape, color, size = 28 }) {
  return (
    <span
      className={`shape-icon shape-icon--${shape}`}
      style={{ '--shape-color': gameColor(color), width: size, height: size }}
    />
  )
}

export default ShapeIcon
