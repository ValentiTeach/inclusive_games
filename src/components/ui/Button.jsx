import { Link } from 'react-router-dom'
import { playClick } from '../../lib/sound'
import './Button.css'

function Button({ to, variant = 'primary', onClick, children, ...rest }) {
  const className = `button button--${variant}`
  // Крапка з брижами — частина вигляду основної кнопки, а не її змісту.
  const content =
    variant === 'primary' ? (
      <>
        <span className="button__label">{children}</span>
        <span className="button__ripple" aria-hidden="true" />
      </>
    ) : (
      children
    )

  function handleClick(event) {
    playClick()
    onClick?.(event)
  }

  if (to) {
    return (
      <Link to={to} className={className} onClick={handleClick} {...rest}>
        {content}
      </Link>
    )
  }

  return (
    <button className={className} onClick={handleClick} {...rest}>
      {content}
    </button>
  )
}

export default Button
