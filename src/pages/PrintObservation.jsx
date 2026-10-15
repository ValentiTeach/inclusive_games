import { Printer } from 'lucide-react'
import './PrintSheets.css'

const HELP_LEVELS = ['сам', 'підказка словом', 'показ', 'рука в руці']
const ATTENTION = ['утримує', 'відволікається', 'потрібне повернення']
const MOODS = ['😀', '🙂', '😐', '🙁', '😢']
const ROWS = 6

/**
 * Порожній бланк спостереження за дитиною під час заняття.
 *
 * Не всі нотатки живуть у щоденнику: на індивідуальному занятті фахівцеві
 * зручніше поставити позначку олівцем, ніж відвести очі від дитини до
 * екрана. Бланк повторює поля щоденника (рівень допомоги, увага, настрій до
 * й після), тож перенести його потім у щоденник — справа хвилини.
 */
function PrintObservation() {
  return (
    <article className="print-sheet">
      <div className="print-sheet__screen-only print-hide">
        <h1>Бланк спостереження</h1>
        <p>
          Порожній бланк на одне заняття: рівень допомоги, увага й настрій дитини. Друкується на
          одному аркуші A4.
        </p>
        <button type="button" className="print-sheet__print" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Друкувати бланк
        </button>
      </div>

      <section className="print-sheet__page" aria-label="Бланк для друку">
        <h2 className="print-sheet__title">Спостереження на занятті</h2>

        <dl className="print-sheet__fields">
          <div>
            <dt>Дитина</dt>
            <dd />
          </div>
          <div>
            <dt>Дата</dt>
            <dd />
          </div>
          <div>
            <dt>Фахівець</dt>
            <dd />
          </div>
          <div>
            <dt>Тривалість</dt>
            <dd />
          </div>
        </dl>

        <div className="print-sheet__mood">
          <p>
            <strong>Настрій до заняття:</strong>{' '}
            {MOODS.map((mood) => (
              <span key={mood} className="print-sheet__box">
                {mood}
              </span>
            ))}
          </p>
        </div>

        <table className="print-sheet__table">
          <thead>
            <tr>
              <th>Вправа / гра</th>
              <th>Допомога</th>
              <th>Увага</th>
              <th>Що помітив</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, index) => (
              <tr key={index}>
                <td />
                <td>
                  {HELP_LEVELS.map((level) => (
                    <span key={level} className="print-sheet__check">
                      ☐ {level}
                    </span>
                  ))}
                </td>
                <td>
                  {ATTENTION.map((item) => (
                    <span key={item} className="print-sheet__check">
                      ☐ {item}
                    </span>
                  ))}
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-sheet__mood">
          <p>
            <strong>Настрій після заняття:</strong>{' '}
            {MOODS.map((mood) => (
              <span key={mood} className="print-sheet__box">
                {mood}
              </span>
            ))}
          </p>
        </div>

        <div className="print-sheet__notes">
          <p>
            <strong>Що вдалося найкраще:</strong>
          </p>
          <p>
            <strong>Що спробувати наступного разу:</strong>
          </p>
        </div>

        <p className="print-sheet__footer">Inclusive Games · бланк спостереження</p>
      </section>
    </article>
  )
}

export default PrintObservation
