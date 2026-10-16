import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { DEVICES, THRESHOLDS, fetchVitals, summarizeVitals } from '../../lib/vitalsReport'
import './ServiceLog.css'

const DAYS = 7
const RATING_TEXT = { good: 'добре', 'needs-improvement': 'так собі', poor: 'повільно' }

function formatValue(name, value) {
  if (value === null) return '—'
  if (name === 'CLS') return value.toFixed(2)
  return value >= 1000 ? `${(value / 1000).toFixed(1)} с` : `${Math.round(value)} мс`
}

/**
 * Швидкість сайту в браузерах дітей і дорослих за тиждень: 75-й процентиль
 * кожного показника по типах пристроїв і найповільніші сторінки.
 *
 * Без міграції 20261015 (таблиці web_vitals ще немає) розділ мовчить.
 */
function VitalsPanel() {
  const [report, setReport] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    fetchVitals({ days: DAYS })
      .then((rows) => {
        if (!cancelled) setReport(summarizeVitals(rows))
      })
      .catch(() => {
        if (!cancelled) setReport(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (report === null) return null

  return (
    <section className="service-log" aria-labelledby="vitals-title">
      <h2 id="vitals-title">
        <Gauge size={20} aria-hidden="true" /> Швидкість сайту
      </h2>
      <p>
        Як швидко сайт відкривається в реальних браузерах за {DAYS} днів: 75% відвідувань не
        повільніші за показане число. Без даних про те, хто це був.
      </p>

      {report === undefined && <p>Завантаження…</p>}
      {report && report.total === 0 && <p>За {DAYS} днів вимірювань ще немає.</p>}

      {report && report.total > 0 && (
        <>
          <div className="service-log__table-wrap">
            <table className="service-log__table">
              <thead>
                <tr>
                  <th>Показник</th>
                  {Object.values(DEVICES).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(THRESHOLDS).map(([name, info]) => (
                  <tr key={name}>
                    <td data-label="Показник">
                      <strong>{name}</strong> — {info.label}
                    </td>
                    {Object.entries(DEVICES).map(([device, label]) => {
                      const cell = report.table[name][device]
                      return (
                        <td key={device} data-label={label} className={cell.rating ? `vitals--${cell.rating}` : undefined}>
                          {formatValue(name, cell.value)}
                          {cell.rating && <span className="vitals__rating"> · {RATING_TEXT[cell.rating]}</span>}
                          {cell.count > 0 && <span className="vitals__count"> ({cell.count})</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.slowPages.length > 0 && (
            <>
              <h3 className="vitals__subtitle">Найповільніші сторінки (головний вміст)</h3>
              <ul className="vitals__pages">
                {report.slowPages.map((page) => (
                  <li key={page.path}>
                    <code>{page.path}</code> — {formatValue('LCP', page.value)} ({page.count})
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

export default VitalsPanel
