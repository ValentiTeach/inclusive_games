import { Footprints, Flame, Star, Compass, Trophy, Target, Puzzle, Brain, Zap } from 'lucide-react'
import { GAMES } from './games'

export const ACHIEVEMENTS = [
  {
    id: 'first-steps',
    title: 'Перші кроки',
    description: 'Зіграй свою першу гру',
    icon: Footprints,
    check: (s) => s.totalAttempts >= 1,
  },
  {
    id: 'streak-3',
    title: 'На вогні',
    description: '3 дні поспіль',
    icon: Flame,
    check: (s) => s.longestStreak >= 3,
  },
  {
    id: 'streak-7',
    title: 'Тиждень поспіль',
    description: '7 днів поспіль',
    icon: Flame,
    check: (s) => s.longestStreak >= 7,
  },
  {
    id: 'streak-14',
    title: 'Два тижні поспіль',
    description: '14 днів поспіль',
    icon: Flame,
    check: (s) => s.longestStreak >= 14,
  },
  {
    id: 'category-attention',
    title: 'Знавець уваги',
    description: '10 спроб у категорії «Увага»',
    icon: Target,
    check: (s) => (s.categoryCounts.attention ?? 0) >= 10,
  },
  {
    id: 'category-memory',
    title: "Знавець пам'яті",
    description: "10 спроб у категорії «Пам'ять»",
    icon: Puzzle,
    check: (s) => (s.categoryCounts.memory ?? 0) >= 10,
  },
  {
    id: 'category-thinking',
    title: 'Знавець мислення',
    description: '10 спроб у категорії «Мислення»',
    icon: Brain,
    check: (s) => (s.categoryCounts.thinking ?? 0) >= 10,
  },
  {
    id: 'category-reaction',
    title: 'Знавець реакції',
    description: '10 спроб у категорії «Реакція»',
    icon: Zap,
    check: (s) => (s.categoryCounts.reaction ?? 0) >= 10,
  },
  {
    id: 'perfect',
    title: 'Ідеально!',
    description: 'Здобудь 100% результат в будь-якій грі',
    icon: Star,
    check: (s) => s.perfectCount >= 1,
  },
  {
    id: 'explorer',
    title: 'Дослідник',
    description: `Зіграй у всі ${GAMES.length} ігор хоч раз`,
    icon: Compass,
    check: (s) => s.distinctGamesPlayed >= GAMES.length,
  },
  {
    id: 'marathoner',
    title: 'Марафонець',
    description: '50 зіграних спроб загалом',
    icon: Trophy,
    check: (s) => s.totalAttempts >= 50,
  },
]
