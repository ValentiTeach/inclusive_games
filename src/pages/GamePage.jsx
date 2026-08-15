import { useParams, Navigate } from 'react-router-dom'
import GameShell from '../games/engine/GameShell'
import { GAME_REGISTRY } from '../games/registry'

function GamePage() {
  const { gameId } = useParams()
  const entry = GAME_REGISTRY[gameId]

  if (!entry) {
    return <Navigate to="/games" replace />
  }

  const { config, PlayArea } = entry

  return (
    <GameShell
      config={config}
      renderPlay={(level, onFinish) => <PlayArea level={level} onFinish={onFinish} />}
    />
  )
}

export default GamePage
