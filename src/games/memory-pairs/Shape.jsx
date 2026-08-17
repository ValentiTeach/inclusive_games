import { SYMBOLS } from './memoryPairs.config'
import ShapeIcon from '../engine/ShapeIcon'

function Shape({ symbolId }) {
  const symbol = SYMBOLS.find((item) => item.id === symbolId)

  return <ShapeIcon shape={symbol.shape} color={symbol.color} size={32} />
}

export default Shape
