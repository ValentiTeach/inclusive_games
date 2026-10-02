import { plantName, slotPosition } from '../../lib/garden'
import './Garden.css'

/*
 * Рослини намальовані простими фігурами: сад має читатися на телефоні в класі
 * так само, як на великому екрані, і працювати без мережі.
 */
function Plant({ plant }) {
  switch (plant) {
    case 'tulip':
      return (
        <g>
          <path d="M0 0 V-18" className="garden__stem" />
          <path d="M-6 -18 Q-6 -30 0 -27 Q6 -30 6 -18 Q0 -14 -6 -18 Z" fill="#e8577a" />
        </g>
      )
    case 'sunflower':
      return (
        <g>
          <path d="M0 0 V-22" className="garden__stem" />
          <circle cy={-26} r={8} fill="#f0c419" />
          <circle cy={-26} r={3.5} fill="#7a4b00" />
        </g>
      )
    case 'tree':
      return (
        <g>
          <rect x={-2} y={-12} width={4} height={12} fill="#8a5a34" />
          <circle cy={-20} r={11} fill="#3f9e5a" />
        </g>
      )
    case 'butterfly':
      return (
        <g transform="translate(0 -22)">
          <ellipse cx={-5} cy={0} rx={5} ry={6} fill="#56b4e9" />
          <ellipse cx={5} cy={0} rx={5} ry={6} fill="#56b4e9" />
          <rect x={-1} y={-5} width={2} height={10} fill="#1b2a44" />
        </g>
      )
    case 'daisy':
      return (
        <g>
          <path d="M0 0 V-16" className="garden__stem" />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <ellipse key={angle} cy={-24} rx={2.5} ry={5} fill="#ffffff" stroke="#d5d9e0" transform={`rotate(${angle} 0 -19)`} />
          ))}
          <circle cy={-19} r={2.6} fill="#f0c419" />
        </g>
      )
    case 'bee':
      return (
        <g transform="translate(0 -24)">
          <ellipse rx={6} ry={4} fill="#f0c419" />
          <path d="M-2 -4 V4 M2 -4 V4" stroke="#1b2a44" strokeWidth={1.5} />
          <ellipse cx={-1} cy={-5} rx={3} ry={2} fill="#dfe8fa" />
        </g>
      )
    case 'mushroom':
      return (
        <g>
          <rect x={-2.5} y={-8} width={5} height={8} fill="#f3e6d3" />
          <path d="M-8 -8 Q0 -20 8 -8 Z" fill="#d55e00" />
        </g>
      )
    case 'rose':
      return (
        <g>
          <path d="M0 0 V-17" className="garden__stem" />
          <circle cy={-21} r={5.5} fill="#cc79a7" />
          <circle cy={-21} r={2.5} fill="#a3507f" />
        </g>
      )
    case 'clover':
      return (
        <g>
          <path d="M0 0 V-7" className="garden__stem" />
          <circle cx={-3} cy={-9} r={3} fill="#4caf6a" />
          <circle cx={3} cy={-9} r={3} fill="#4caf6a" />
          <circle cy={-12} r={3} fill="#4caf6a" />
        </g>
      )
    case 'grass':
      return <path d="M-5 0 L-3 -9 M0 0 V-12 M5 0 L3 -9" className="garden__grass" />
    default:
      return (
        <g>
          <path d="M0 0 V-8" className="garden__stem" />
          <path d="M0 -6 Q-6 -10 -6 -4 Q-2 -4 0 -6 M0 -8 Q6 -12 6 -6 Q2 -6 0 -8" fill="#4caf6a" />
        </g>
      )
  }
}

function Garden({ garden, highlightLast = false }) {
  const { items } = garden
  const last = items.at(-1)
  const label = items.length
    ? `Сад: ${items.length} ${items.length === 1 ? 'рослина' : 'рослин'}${last ? `, остання — ${plantName(last.plant)}` : ''}`
    : 'Сад поки порожній'

  return (
    <svg className="garden" viewBox="0 0 380 230" role="img" aria-label={label}>
      <rect className="garden__sky" width={380} height={110} />
      <circle cx={330} cy={40} r={18} className="garden__sun" />
      <rect className="garden__ground" y={95} width={380} height={135} rx={0} />
      {items.map((item) => {
        const { x, y } = slotPosition(item.slot)
        const isNew = highlightLast && item === last
        return (
          <g key={item.id} transform={`translate(${x} ${y})`} className={isNew ? 'garden__item is-new' : 'garden__item'}>
            {isNew && <circle cy={-14} r={18} className="garden__glow" />}
            <Plant plant={item.plant} />
          </g>
        )
      })}
    </svg>
  )
}

export default Garden
