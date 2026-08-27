import './DecorativeBackground.css'

function DecorativeBackground() {
  return (
    <div className="decor" aria-hidden="true">
      <div className="decor__photo" />
      <span className="decor__blob decor__blob--attention" />
      <span className="decor__blob decor__blob--memory" />
      <span className="decor__blob decor__blob--thinking" />
      <span className="decor__blob decor__blob--reaction" />
      <span className="decor__blob decor__blob--accent-a" />
      <span className="decor__blob decor__blob--accent-b" />
    </div>
  )
}

export default DecorativeBackground
