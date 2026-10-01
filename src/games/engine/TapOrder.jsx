import { RotateCcw } from 'lucide-react'
import OptionKey from './OptionKey'
import { playClick } from '../../lib/sound'
import { useGameKeys } from './useGameKeys'
import './TapOrder.css'

/**
 * Розставити картки по порядку — натисканнями, а не перетягуванням.
 *
 * Перетягування на телефоні й для дитини з моторними труднощами — окреме
 * випробування, яке не має стосунку до того, що гра перевіряє. Тут кожне
 * натискання дає картці наступний номер: «це перше, це друге…». Помилився —
 * натисни картку ще раз, і номер знімається разом з усіма після нього.
 *
 * `order` — масив id у тому порядку, в якому їх натиснуто. Коли пронумеровано
 * всі, викликається `onComplete(order)`.
 */
function TapOrder({ items, order, onChange, onComplete, disabled, renderItem, feedback }) {
  function handleTap(id) {
    if (disabled) return
    playClick()
    const position = order.indexOf(id)
    if (position !== -1) {
      onChange(order.slice(0, position))
      return
    }
    const next = [...order, id]
    onChange(next)
    if (next.length === items.length) onComplete(next)
  }

  useGameKeys({
    enabled: !disabled,
    optionCount: items.length,
    onOption: (index) => handleTap(items[index].id),
    onCancel: () => onChange([]),
  })

  return (
    <div className="tap-order">
      <div className="tap-order__items">
        {items.map((item, index) => {
          const position = order.indexOf(item.id)
          return (
            <button
              key={item.id}
              type="button"
              className={[
                'tap-order__item',
                position !== -1 ? 'is-placed' : '',
                feedback?.[item.id] ? `is-${feedback[item.id]}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTap(item.id)}
              aria-disabled={disabled}
              aria-label={`${item.label}${position !== -1 ? `, номер ${position + 1}` : ''}`}
            >
              <OptionKey n={index + 1} />
              {position !== -1 && (
                <span className="tap-order__badge" aria-hidden="true">
                  {position + 1}
                </span>
              )}
              {renderItem(item)}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="tap-order__reset"
        onClick={() => onChange([])}
        disabled={disabled || order.length === 0}
      >
        <RotateCcw size={16} aria-hidden="true" />
        Почати розставляти знову
      </button>
    </div>
  )
}

export default TapOrder
