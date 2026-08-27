import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../../lib/settings'
import './Confetti.css'

const COLORS = ['var(--accent)', 'var(--cat-attention)', 'var(--cat-memory)', 'var(--cat-thinking)', 'var(--cat-reaction)']
const PARTICLE_COUNT = 24

function Confetti() {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (prefersReducedMotion()) return undefined

    const id = setTimeout(() => {
      setParticles(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.3,
          duration: 1.1 + Math.random() * 0.6,
          color: COLORS[i % COLORS.length],
        })),
      )
    }, 0)

    return () => clearTimeout(id)
  }, [])

  return (
    <div className="confetti" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  )
}

export default Confetti
