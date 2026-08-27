import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../lib/settings'

function CountUpNumber({ value, duration = 700, className }) {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0)
  const frameRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      const id = setTimeout(() => setDisplay(value), 0)
      return () => clearTimeout(id)
    }

    const start = performance.now()
    const from = 0

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return <span className={className}>{display}</span>
}

export default CountUpNumber
