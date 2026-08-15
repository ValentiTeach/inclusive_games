import { config as schulteConfig } from './schulte/schulte.config'
import SchultePlayArea from './schulte/SchultePlayArea'
import { config as stroopConfig } from './stroop/stroop.config'
import StroopPlayArea from './stroop/StroopPlayArea'

export const GAME_REGISTRY = {
  schulte: { config: schulteConfig, PlayArea: SchultePlayArea },
  stroop: { config: stroopConfig, PlayArea: StroopPlayArea },
}
