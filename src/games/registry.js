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
import { config as nbackConfig } from './n-back/nback.config'
import NBackPlayArea from './n-back/NBackPlayArea'
import { config as targetSearchConfig } from './target-search/targetSearch.config'
import TargetSearchPlayArea from './target-search/TargetSearchPlayArea'
import { config as matricesConfig } from './matrices/matrices.config'
import MatricesPlayArea from './matrices/MatricesPlayArea'
import { config as mentalRotationConfig } from './mental-rotation/mentalRotation.config'
import MentalRotationPlayArea from './mental-rotation/MentalRotationPlayArea'

export const GAME_REGISTRY = {
  schulte: { config: schulteConfig, PlayArea: SchultePlayArea },
  stroop: { config: stroopConfig, PlayArea: StroopPlayArea },
  simon: { config: simonConfig, PlayArea: SimonPlayArea },
  'memory-pairs': { config: memoryPairsConfig, PlayArea: MemoryPairsPlayArea },
  'reaction-time': { config: reactionTimeConfig, PlayArea: ReactionTimePlayArea },
  'quick-math': { config: quickMathConfig, PlayArea: QuickMathPlayArea },
  subitizing: { config: subitizingConfig, PlayArea: SubitizingPlayArea },
  'go-no-go': { config: goNoGoConfig, PlayArea: GoNoGoPlayArea },
  'n-back': { config: nbackConfig, PlayArea: NBackPlayArea },
  'target-search': { config: targetSearchConfig, PlayArea: TargetSearchPlayArea },
  matrices: { config: matricesConfig, PlayArea: MatricesPlayArea },
  'mental-rotation': { config: mentalRotationConfig, PlayArea: MentalRotationPlayArea },
}
