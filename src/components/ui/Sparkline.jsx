import './Sparkline.css'

const WIDTH = 200
const HEIGHT = 48
const PADDING = 4

function Sparkline({ values }) {
  if (values.length < 2) {
    return <p className="sparkline sparkline--empty">Замало спроб для графіка</p>
  }

  const usableHeight = HEIGHT - PADDING * 2
  const stepX = (WIDTH - PADDING * 2) / (values.length - 1)

  const points = values.map((value, index) => {
    const x = PADDING + index * stepX
    const y = PADDING + usableHeight - (value / 100) * usableHeight
    return `${x},${y}`
  })

  const lastPoint = points[points.length - 1].split(',')

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Графік результатів: від ${values[0]}% до ${values[values.length - 1]}%`}
    >
      <polyline className="sparkline__line" points={points.join(' ')} />
      <circle className="sparkline__dot" cx={lastPoint[0]} cy={lastPoint[1]} r="3" />
    </svg>
  )
}

export default Sparkline
