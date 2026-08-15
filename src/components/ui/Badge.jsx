import './Badge.css'

function Badge({ tone = 'muted', children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {children}
    </span>
  )
}

export default Badge
