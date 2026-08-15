import { config as schulteConfig } from './schulte/schulte.config'
import SchultePlayArea from './schulte/SchultePlayArea'
import { config as stroopConfig } from './stroop/stroop.config'
import StroopPlayArea from './stroop/StroopPlayArea'
import { config as simonConfig } from './simon/simon.config'
import SimonPlayArea from './simon/SimonPlayArea'
import { config as memoryPairsConfig } from './memory-pairs/memoryPairs.config'
import MemoryPairsPlayArea from './memory-pairs/MemoryPairsPlayArea'
import { config as reactionTimeConfig } from './reaction-time/reactionTime.config'
import ReactionTimePlayArea from './reaction-time/ReactionTimePlayArea'
import { config as quickMathConfig } from './quick-math/quickMath.config'
import QuickMathPlayArea from './quick-math/QuickMathPlayArea'
import { config as subitizingConfig } from './subitizing/subitizing.config'
import SubitizingPlayArea from './subitizing/SubitizingPlayArea'
import { config as goNoGoConfig } from './go-no-go/goNoGo.config'
import GoNoGoPlayArea from './go-no-go/GoNoGoPlayArea'

export const GAME_REGISTRY = {
  schulte: { config: schulteConfig, PlayArea: SchultePlayArea },
  stroop: { config: stroopConfig, PlayArea: StroopPlayArea },
  simon: { config: simonConfig, PlayArea: SimonPlayArea },
  'memory-pairs': { config: memoryPairsConfig, PlayArea: MemoryPairsPlayArea },
  'reaction-time': { config: reactionTimeConfig, PlayArea: ReactionTimePlayArea },
  'quick-math': { config: quickMathConfig, PlayArea: QuickMathPlayArea },
  subitizing: { config: subitizingConfig, PlayArea: SubitizingPlayArea },
  'go-no-go': { config: goNoGoConfig, PlayArea: GoNoGoPlayArea },
}
