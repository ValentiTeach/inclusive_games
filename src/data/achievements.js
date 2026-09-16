import {
  Footprints,
  Flame,
  Star,
  Compass,
  Trophy,
  Target,
  Puzzle,
  Brain,
  Zap,
  Sparkles,
  Sunrise,
  Layers,
  TrendingUp,
} from 'lucide-react'
import { GAMES } from './games'

/**
 * Досягнення описуються прогресом, а не перевіркою «є / немає».
 *
 * Раніше кожне мало окремий check, і дитина бачила лише замкнений значок: ні
 * скільки треба, ні скільки вже пройдено. Тепер кожне каже, де ти зараз і де
 * межа, а «здобуто» виводиться з тих самих чисел — одне визначення замість
 * двох, які рано чи пізно розійшлися б і лишили значок замкненим при 10 із 10.
 */
const GAMES_PER_CATEGORY = GAMES.reduce((counts, game) => {
  counts[game.category] = (counts[game.category] ?? 0) + 1
  return counts
}, {})

export const ACHIEVEMENTS = [
  {
    id: 'first-steps',
    title: 'Перші кроки',
    description: 'Зіграй свою першу гру',
    icon: Footprints,
    progress: (s) => ({ current: s.totalAttempts, target: 1 }),
  },
  {
    id: 'streak-3',
    title: 'На вогні',
    description: '3 дні поспіль',
    icon: Flame,
    progress: (s) => ({ current: s.longestStreak, target: 3 }),
  },
  {
    id: 'streak-7',
    title: 'Тиждень поспіль',
    description: '7 днів поспіль',
    icon: Flame,
    progress: (s) => ({ current: s.longestStreak, target: 7 }),
  },
  {
    id: 'streak-14',
    title: 'Два тижні поспіль',
    description: '14 днів поспіль',
    icon: Flame,
    progress: (s) => ({ current: s.longestStreak, target: 14 }),
  },
  {
    id: 'category-attention',
    title: 'Знавець уваги',
    description: '10 спроб у категорії «Увага»',
    icon: Target,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).attention ?? 0, target: 10 }),
  },
  {
    id: 'category-memory',
    title: "Знавець пам'яті",
    description: "10 спроб у категорії «Пам'ять»",
    icon: Puzzle,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).memory ?? 0, target: 10 }),
  },
  {
    id: 'category-thinking',
    title: 'Знавець мислення',
    description: '10 спроб у категорії «Мислення»',
    icon: Brain,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).thinking ?? 0, target: 10 }),
  },
  {
    id: 'category-reaction',
    title: 'Знавець реакції',
    description: '10 спроб у категорії «Реакція»',
    icon: Zap,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).reaction ?? 0, target: 10 }),
  },
  {
    id: 'perfect',
    title: 'Ідеально!',
    description: 'Здобудь 100% результат в будь-якій грі',
    icon: Star,
    progress: (s) => ({ current: s.perfectCount, target: 1 }),
  },
  {
    id: 'explorer',
    title: 'Дослідник',
    description: `Зіграй у всі ${GAMES.length} ігор хоч раз`,
    icon: Compass,
    progress: (s) => ({ current: s.distinctGamesPlayed, target: GAMES.length }),
  },
  {
    id: 'marathoner',
    title: 'Марафонець',
    description: '50 зіграних спроб загалом',
    icon: Trophy,
    progress: (s) => ({ current: s.totalAttempts, target: 50 }),
  },

  /*
   * Нижче — досягнення за вміння, а не за кількість. Старі одинадцять майже всі
   * вимірювали, скільки дитина натиснула; ці вимірюють, наскільки добре.
   */
  {
    id: 'perfect-run-3',
    title: 'Три поспіль',
    description: 'Три ідеальні результати підряд',
    icon: Sparkles,
    progress: (s) => ({ current: s.longestPerfectRun ?? 0, target: 3 }),
  },
  {
    id: 'all-skills-one-day',
    title: 'Усе за день',
    description: 'Усі чотири навички за один день',
    icon: Sunrise,
    progress: (s) => ({ current: s.mostCategoriesInADay ?? 0, target: 4 }),
  },
  {
    id: 'attention-complete',
    title: 'Уся увага',
    description: `Зіграй у всі ${GAMES_PER_CATEGORY.attention} ігор категорії «Увага»`,
    icon: Target,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).attention ?? 0,
      target: GAMES_PER_CATEGORY.attention,
    }),
  },
  {
    id: 'memory-complete',
    title: "Уся пам'ять",
    description: `Зіграй у всі ${GAMES_PER_CATEGORY.memory} ігор категорії «Пам'ять»`,
    icon: Puzzle,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).memory ?? 0,
      target: GAMES_PER_CATEGORY.memory,
    }),
  },
  {
    id: 'thinking-complete',
    title: 'Усе мислення',
    description: `Зіграй у всі ${GAMES_PER_CATEGORY.thinking} ігор категорії «Мислення»`,
    icon: Brain,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).thinking ?? 0,
      target: GAMES_PER_CATEGORY.thinking,
    }),
  },
  {
    id: 'reaction-complete',
    title: 'Уся реакція',
    description: `Зіграй у всі ${GAMES_PER_CATEGORY.reaction} ігор категорії «Реакція»`,
    icon: Zap,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).reaction ?? 0,
      target: GAMES_PER_CATEGORY.reaction,
    }),
  },
  {
    id: 'five-perfect-games',
    title: 'П’ять вершин',
    description: 'Ідеальний результат у п’яти різних іграх',
    icon: TrendingUp,
    progress: (s) => ({ current: s.gamesWithPerfect ?? 0, target: 5 }),
  },
  {
    id: 'ten-games-mastered',
    title: 'Широкий крок',
    description: 'Зіграй щонайменше по три рази в десяти іграх',
    icon: Layers,
    progress: (s) => ({ current: s.gamesPlayedThrice ?? 0, target: 10 }),
  },
]

/**
 * Скільки пройдено, скільки треба і чи вже здобуто. current обрізається по
 * target: «12 із 10» на значку виглядає як помилка, а не як перевиконання.
 */
export function achievementProgress(achievement, stats) {
  const { current, target } = achievement.progress(stats)
  return {
    current: Math.min(current, target),
    target,
    unlocked: current >= target,
  }
}

export function isUnlocked(achievement, stats) {
  return achievementProgress(achievement, stats).unlocked
}
