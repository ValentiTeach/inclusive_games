export const CATEGORIES = {
  attention: { label: 'Увага', color: 'attention' },
  memory: { label: "Пам'ять", color: 'memory' },
  thinking: { label: 'Мислення', color: 'thinking' },
  reaction: { label: 'Реакція', color: 'reaction' },
}

export const GAMES = [
  {
    id: 'schulte',
    title: 'Таблиці Шульте',
    category: 'attention',
    description: 'Знайди числа від 1 до 25 по порядку якнайшвидше.',
    status: 'available',
  },
  {
    id: 'stroop',
    title: 'Тест Струпа',
    category: 'attention',
    description: 'Назви колір шрифту, а не слово, яке написане.',
    status: 'available',
  },
  {
    id: 'go-no-go',
    title: 'Go / No-Go',
    category: 'attention',
    description: 'Тисни на потрібний сигнал і ігноруй інші.',
    status: 'coming-soon',
  },
  {
    id: 'subitizing',
    title: 'Субітизація',
    category: 'attention',
    description: 'Оціни кількість об’єктів з першого погляду.',
    status: 'coming-soon',
  },
  {
    id: 'simon',
    title: 'Simon / Корсі',
    category: 'memory',
    description: 'Повтори послідовність спалахів у правильному порядку.',
    status: 'coming-soon',
  },
  {
    id: 'memory-pairs',
    title: 'Знайди пару',
    category: 'memory',
    description: 'Класична гра на запам’ятовування карток.',
    status: 'coming-soon',
  },
  {
    id: 'quick-math',
    title: 'Швидкий рахунок',
    category: 'thinking',
    description: 'Розв’яжи якомога більше прикладів на час.',
    status: 'coming-soon',
  },
  {
    id: 'reaction-time',
    title: 'Швидкість реакції',
    category: 'reaction',
    description: 'Натисни, щойно на екрані з’явиться сигнал.',
    status: 'coming-soon',
  },
]
