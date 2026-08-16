import { SYMBOLS } from './memoryPairs.config'

function Shape({ symbolId }) {
  const symbol = SYMBOLS.find((item) => item.id === symbolId)

  return (
    <span
      className={`shape shape--${symbol.shape}`}
      style={{ '--shape-color': symbol.color }}
    />
  )
}

export default Shape
