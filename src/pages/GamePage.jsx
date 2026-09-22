import { Suspense, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import GameShell from '../games/engine/GameShell'
import { GAME_REGISTRY, preloadPlayArea } from '../games/registry'
import { GAMES } from '../data/games'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'

function GamePage() {
  const { gameId } = useParams()
  const { user, loading } = useAuth()
  const entry = GAME_REGISTRY[gameId]
  const gameInfo = GAMES.find((game) => game.id === gameId)

  // Поле гри вантажиться окремим шматком. Просити його вже тут, а не в мить
  // старту, — це різниця між «дитина натиснула Почати і грає» і «дитина
  // натиснула Почати, відлік минув, екран порожній». Ефект, а не виклик під час
  // рендера: у строгому режимі рендер може повторитися, а мережа — не місце для
  // побічних ефектів рендера.
  useEffect(() => {
    preloadPlayArea(gameId)
  }, [gameId])

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
      renderPlay={(level, onFinish) => (
        // Suspense всередині renderPlay, а не навколо GameShell: інакше очікування
        // шматка знесло б і заголовок гри, і зворотний відлік — дитина побачила б
        // порожню сторінку замість гри, яка ось-ось почнеться.
        <Suspense fallback={<p className="game-shell__loading">Гра завантажується…</p>}>
          <PlayArea level={level} onFinish={onFinish} />
        </Suspense>
      )}
    />
  )
}

export default GamePage
