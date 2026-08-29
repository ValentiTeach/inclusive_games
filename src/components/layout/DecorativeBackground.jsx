import { useState } from 'react'
import { Brain, HeartHandshake, Puzzle, Sparkles, Smile, ShieldCheck, Target, Zap } from 'lucide-react'
import { playClick } from '../../lib/sound'
import './DecorativeBackground.css'

// Effects on click, thematically matched to each icon:
// - pop: bounce + spin burst (default)
// - pulse: two-beat "heartbeat" scale, for the heart icon
// - burst: spawns a handful of tiny sparks flying outward, for Sparkles
// - wiggle: rapid side-to-side shake, for Target ("шукає ціль")
const FLOATING_ICONS = [
  { id: 'brain', Icon: Brain, top: '14%', left: '6%', size: 34, duration: 9, drift: 1, interactive: true, effect: 'pop' },
  { id: 'heart', Icon: HeartHandshake, top: '68%', left: '10%', size: 30, duration: 7, drift: 2, interactive: true, effect: 'pulse' },
  { id: 'puzzle', Icon: Puzzle, top: '30%', left: '88%', size: 32, duration: 10, drift: 3, interactive: true, effect: 'pop' },
  { id: 'sparkles', Icon: Sparkles, top: '78%', left: '82%', size: 26, duration: 6, drift: 4, interactive: true, effect: 'burst' },
  { id: 'smile', Icon: Smile, top: '48%', left: '4%', size: 28, duration: 8, drift: 5, interactive: false },
  { id: 'shield', Icon: ShieldCheck, top: '10%', left: '70%', size: 28, duration: 9.5, drift: 2, interactive: false },
  { id: 'target', Icon: Target, top: '58%', left: '92%', size: 26, duration: 7.5, drift: 1, interactive: true, effect: 'wiggle' },
  { id: 'zap', Icon: Zap, top: '86%', left: '46%', size: 24, duration: 5.5, drift: 3, interactive: false },
]

const SPARK_COUNT = 6

function FloatingIcon({ Icon, top, left, size, duration, drift, interactive, effect }) {
  const [active, setActive] = useState(false)

  function handleClick() {
    if (!interactive || active) return
    setActive(true)
    playClick()
    setTimeout(() => setActive(false), 600)
  }

  const className = [
    'decor__icon-wrap',
    `decor__icon-wrap--drift-${drift}`,
    interactive && 'decor__icon-wrap--interactive',
    active && `decor__icon-wrap--${effect}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={className}
      style={{ top, left, animationDuration: `${duration}s` }}
      onClick={interactive ? handleClick : undefined}
    >
      <Icon className="decor__icon" size={size} style={{ animationDuration: `${duration * 0.8}s` }} aria-hidden="true" />
      {effect === 'burst' && active && (
        <span className="decor__sparks">
          {Array.from({ length: SPARK_COUNT }, (_, i) => (
            <span key={i} className="decor__spark" style={{ '--angle': `${(360 / SPARK_COUNT) * i}deg` }} />
          ))}
        </span>
      )}
    </span>
  )
}

function DecorativeBackground() {
  return (
    <div className="decor" aria-hidden="true">
      <div className="decor__photo" />
      <span className="decor__blob decor__blob--a" />
      <span className="decor__blob decor__blob--b" />
      <span className="decor__blob decor__blob--c" />
      <span className="decor__blob decor__blob--d" />
      {FLOATING_ICONS.map((icon) => (
        <FloatingIcon key={icon.id} {...icon} />
      ))}
    </div>
  )
}

export default DecorativeBackground
