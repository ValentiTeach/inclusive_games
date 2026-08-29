import { useState } from 'react'
import { getSettings, prefersReducedMotion } from '../../lib/settings'

// Temporary diagnostic banner to find out why decorative animations
// appear frozen for a specific user. Remove once resolved.
function MotionDebugBanner() {
  const [info] = useState(() => ({
    osReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    siteReduced: getSettings().reducedMotion,
    combined: prefersReducedMotion(),
  }))

  const blocked = info.combined

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        padding: '10px 16px',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 700,
        textAlign: 'center',
        color: '#fff',
        background: blocked ? '#c0392b' : '#1a9850',
      }}
    >
      {blocked
        ? `АНІМАЦІЇ ВИМКНЕНО: система/браузер каже "зменшений рух" = ${info.osReduced ? 'ТАК' : 'ні'}, налаштування сайту = ${info.siteReduced ? 'ТАК' : 'ні'}`
        : 'Анімації НЕ заблоковані цим браузером — рух має бути видно'}
    </div>
  )
}

export default MotionDebugBanner
