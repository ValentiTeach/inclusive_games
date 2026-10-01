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
  Ear,
  Move,
  Hourglass,
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
/* «у всі 4 гри», «у всі 7 ігор»: з новими категоріями кількість ігор стала
   різною, і одне слово «ігор» на всі випадки читалося б як помилка. */
function games(count) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} ігор`
  if (last === 1) return `${count} гру`
  if (last >= 2 && last <= 4) return `${count} гри`
  return `${count} ігор`
}

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
    id: 'category-speech',
    title: 'Знавець звуків',
    description: '10 спроб у категорії «Слух і мовлення»',
    icon: Ear,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).speech ?? 0, target: 10 }),
  },
  {
    id: 'category-space',
    title: 'Знавець простору',
    description: '10 спроб у категорії «Простір і рух»',
    icon: Move,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).space ?? 0, target: 10 }),
  },
  {
    id: 'category-regulation',
    title: 'Знавець витримки',
    description: '10 спроб у категорії «Саморегуляція»',
    icon: Hourglass,
    progress: (s) => ({ current: (s.categoryCounts ?? {}).regulation ?? 0, target: 10 }),
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
    description: `Зіграй у всі ${games(GAMES.length)} хоч раз`,
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
    // Навичок тепер сім, але мета лишилась чотири: сім за день — це вже
    // не досягнення, а повинність для дитини, якій вистачає трьох ігор на день.
    description: 'Чотири різні навички за один день',
    icon: Sunrise,
    progress: (s) => ({ current: s.mostCategoriesInADay ?? 0, target: 4 }),
  },
  {
    id: 'attention-complete',
    title: 'Уся увага',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.attention)} категорії «Увага»`,
    icon: Target,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).attention ?? 0,
      target: GAMES_PER_CATEGORY.attention,
    }),
  },
  {
    id: 'memory-complete',
    title: "Уся пам'ять",
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.memory)} категорії «Пам'ять»`,
    icon: Puzzle,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).memory ?? 0,
      target: GAMES_PER_CATEGORY.memory,
    }),
  },
  {
    id: 'thinking-complete',
    title: 'Усе мислення',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.thinking)} категорії «Мислення»`,
    icon: Brain,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).thinking ?? 0,
      target: GAMES_PER_CATEGORY.thinking,
    }),
  },
  {
    id: 'reaction-complete',
    title: 'Уся реакція',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.reaction)} категорії «Реакція»`,
    icon: Zap,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).reaction ?? 0,
      target: GAMES_PER_CATEGORY.reaction,
    }),
  },
  {
    id: 'speech-complete',
    title: 'Увесь слух',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.speech)} категорії «Слух і мовлення»`,
    icon: Ear,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).speech ?? 0,
      target: GAMES_PER_CATEGORY.speech,
    }),
  },
  {
    id: 'space-complete',
    title: 'Увесь простір',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.space)} категорії «Простір і рух»`,
    icon: Move,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).space ?? 0,
      target: GAMES_PER_CATEGORY.space,
    }),
  },
  {
    id: 'regulation-complete',
    title: 'Уся витримка',
    description: `Зіграй у всі ${games(GAMES_PER_CATEGORY.regulation)} категорії «Саморегуляція»`,
    icon: Hourglass,
    progress: (s) => ({
      current: (s.distinctGamesByCategory ?? {}).regulation ?? 0,
      target: GAMES_PER_CATEGORY.regulation,
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
