import { useState } from 'react'
import { Brain, HeartHandshake, Puzzle, Sparkles, Smile, ShieldCheck, Target, Zap } from 'lucide-react'
import { playClick } from '../../lib/sound'
import './DecorativeBackground.css'

const FLOATING_ICONS = [
  { id: 'brain', Icon: Brain, top: '14%', left: '6%', size: 34, duration: 26, interactive: true },
  { id: 'heart', Icon: HeartHandshake, top: '68%', left: '10%', size: 30, duration: 22, interactive: true },
  { id: 'puzzle', Icon: Puzzle, top: '30%', left: '88%', size: 32, duration: 30, interactive: true },
  { id: 'sparkles', Icon: Sparkles, top: '78%', left: '82%', size: 26, duration: 18, interactive: true },
  { id: 'smile', Icon: Smile, top: '48%', left: '4%', size: 28, duration: 24, interactive: false },
  { id: 'shield', Icon: ShieldCheck, top: '10%', left: '70%', size: 28, duration: 28, interactive: false },
  { id: 'target', Icon: Target, top: '58%', left: '92%', size: 26, duration: 20, interactive: true },
  { id: 'zap', Icon: Zap, top: '86%', left: '46%', size: 24, duration: 16, interactive: false },
]

function FloatingIcon({ Icon, top, left, size, duration, interactive }) {
  const [popping, setPopping] = useState(false)

  function handleClick() {
    if (!interactive || popping) return
    setPopping(true)
    playClick()
    setTimeout(() => setPopping(false), 500)
  }

  const className = [
    'decor__icon-wrap',
    interactive && 'decor__icon-wrap--interactive',
    popping && 'decor__icon-wrap--pop',
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
