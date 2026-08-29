import { useEffect, useRef, useState } from 'react'
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
const FLEE_RADIUS = 130
const FLEE_STRENGTH = 46

function FloatingIcon({ Icon, top, left, size, duration, drift, interactive, effect, iconRef }) {
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
      <Icon
        ref={iconRef}
        className="decor__icon"
        size={size}
        style={{ animationDuration: `${duration * 0.8}s` }}
        aria-hidden="true"
      />
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

// A small patch of dots that lights up in a "flashlight" ring following
// the cursor. Position is driven centrally (see DecorativeBackground's
// tick loop) rather than by mousemove/mouseleave props on this element:
// .app-content sits in a higher stacking context (needed to fix an
// earlier bleed-through bug) and would intercept pointer events over
// this whole area even though nothing is visibly drawn there, so a
// listener on the grid itself would never fire. Tracking the cursor
// globally and computing "is it over this grid" ourselves sidesteps
// that entirely — the same trick already used for the fleeing icons.
function InteractiveGrid({ top, left, right, bottom, gridRef, glowRef }) {
  return (
    <div className="decor__grid" ref={gridRef} style={{ top, left, right, bottom }}>
      <div className="decor__grid-dots" />
      <div ref={glowRef} className="decor__grid-glow" />
    </div>
  )
}

const GRID_ZONES = [
  { id: 'grid-a', bottom: '6%', left: '1%' },
  { id: 'grid-b', top: '18%', right: '1%' },
]

function DecorativeBackground() {
  const iconRefs = useRef([])
  const gridRefs = useRef([])
  const glowRefs = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    function handleMove(event) {
      mouseRef.current = { x: event.clientX, y: event.clientY }
    }

    let frameId
    function tick() {
      const { x: mx, y: my } = mouseRef.current

      iconRefs.current.forEach((el) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - mx
        const dy = cy - my
        const dist = Math.hypot(dx, dy)

        if (dist < FLEE_RADIUS && dist > 0.5) {
          const strength = (1 - dist / FLEE_RADIUS) * FLEE_STRENGTH
          el.style.translate = `${((dx / dist) * strength).toFixed(1)}px ${((dy / dist) * strength).toFixed(1)}px`
        } else {
          el.style.translate = '0px 0px'
        }
      })

      gridRefs.current.forEach((gridEl, i) => {
        const glowEl = glowRefs.current[i]
        if (!gridEl || !glowEl) return
        const rect = gridEl.getBoundingClientRect()
        const inside = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom
        if (inside) {
          glowEl.style.setProperty('--gx', `${mx - rect.left}px`)
          glowEl.style.setProperty('--gy', `${my - rect.top}px`)
        } else {
          glowEl.style.setProperty('--gx', '-9999px')
        }
      })

      frameId = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    frameId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="decor" aria-hidden="true">
      <div className="decor__photo" />
      <span className="decor__blob decor__blob--a" />
      <span className="decor__blob decor__blob--b" />
      <span className="decor__blob decor__blob--c" />
      <span className="decor__blob decor__blob--d" />
      {GRID_ZONES.map((zone, index) => (
        <InteractiveGrid
          key={zone.id}
          top={zone.top}
          left={zone.left}
          right={zone.right}
          bottom={zone.bottom}
          gridRef={(el) => {
            gridRefs.current[index] = el
          }}
          glowRef={(el) => {
            glowRefs.current[index] = el
          }}
        />
      ))}
      {FLOATING_ICONS.map((icon, index) => (
        <FloatingIcon
          key={icon.id}
          {...icon}
          iconRef={(el) => {
            iconRefs.current[index] = el
          }}
        />
      ))}
    </div>
  )
}

export default DecorativeBackground
