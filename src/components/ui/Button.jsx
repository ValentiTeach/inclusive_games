import { Link } from 'react-router-dom'
import { playClick } from '../../lib/sound'
import './Button.css'

function Button({ to, variant = 'primary', onClick, children, ...rest }) {
  const className = `button button--${variant}`

  function handleClick(event) {
    playClick()
    onClick?.(event)
  }

  if (to) {
    return (
      <Link to={to} className={className} onClick={handleClick} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <button className={className} onClick={handleClick} {...rest}>
      {children}
    </button>
  )
}

export default Button
