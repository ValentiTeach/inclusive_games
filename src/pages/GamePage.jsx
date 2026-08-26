import { useParams, Navigate } from 'react-router-dom'
import GameShell from '../games/engine/GameShell'
import { GAME_REGISTRY } from '../games/registry'
import { GAMES } from '../data/games'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'

function GamePage() {
  const { gameId } = useParams()
  const { user, loading } = useAuth()
  const entry = GAME_REGISTRY[gameId]
  const gameInfo = GAMES.find((game) => game.id === gameId)

  if (!entry || !gameInfo) {
    return <Navigate to="/games" replace />
  }

  if (loading) {
    return null
  }

  if (isCloudConfigured && !user && !gameInfo.freeForGuests) {
    return <Navigate to="/login" replace />
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
