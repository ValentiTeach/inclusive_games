import { Link } from 'react-router-dom'
import { metricHelp } from '../../data/metricHelp'
import { metricLabel } from '../../games/engine/metrics'
import './MetricHelp.css'

/**
 * «?» біля показника: підказка одним реченням при наведенні й посилання на
 * пояснення в довідці. Для показників, що говорять самі за себе («Проб»),
 * нічого не малює — знак питання біля «Помилок» був би шумом.
 *
 * На папері не друкується: на аркуші знак питання нікуди не веде.
 */
function MetricHelp({ metric }) {
  const help = metricHelp(metric)
  if (!help) return null

  const label = metricLabel(metric).split(',')[0]

  return (
    <Link
      to={`/help#metric-${metric}`}
      className="metric-help print-hide"
      title={help.short}
      aria-label={`Що означає «${label}»`}
    >
      ?
    </Link>
  )
}

export default MetricHelp
