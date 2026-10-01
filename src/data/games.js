/*
 * Навички. `color` — ключ кольору категорії в CSS (`--cat-<color>`).
 *
 * «Слух і мовлення» та «Простір і рух» з'явилися пізніше за перші чотири: до
 * них усі ігри були зоровими й відповідалися кнопкою, тож ні слухової уваги, ні
 * фонематичного слуху, ні просторової орієнтації, ні руки платформа не
 * тренувала взагалі.
 */
export const CATEGORIES = {
  attention: { label: 'Увага', color: 'attention' },
  memory: { label: "Пам'ять", color: 'memory' },
  thinking: { label: 'Мислення', color: 'thinking' },
  reaction: { label: 'Реакція', color: 'reaction' },
  speech: { label: 'Слух і мовлення', color: 'speech' },
  space: { label: 'Простір і рух', color: 'space' },
}

/*
 * Єдине джерело назви, категорії й опису гри.
 *
 * Досі опис жив двічі — тут для каталогу і в конфігу гри для екрана вступу, — і
 * за кілька місяців ці два тексти розійшлися: Go/No-Go в каталозі обіцяв
 * «потрібний сигнал», а на вступі вже казав про зелене коло. Тепер конфіг бере
 * все звідси через gameInfo(), і розійтися нема чому.
 *
 * Конфіги імпортують цей файл, а не навпаки: каталог і шапка потрібні на кожній
 * сторінці, і тягнути з ними логіку всіх ігор означало б роздути початкове
 * завантаження заради трьох рядків тексту.
 */
export const GAMES = [
  {
    id: 'schulte',
    title: 'Таблиці Шульте',
    category: 'attention',
    description:
      'Знайди числа від 1 до N по порядку якнайшвидше, не відриваючи погляд від центру таблиці.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'stroop',
    title: 'Тест Струпа',
    category: 'attention',
    description: 'Обери колір, яким написано слово, — а не те, що воно означає.',
    status: 'available',
  },
  {
    id: 'day-night',
    title: 'День і ніч',
    category: 'attention',
    description:
      'Побачив сонце — тисни «Ніч», побачив місяць — тисни «День». Струп без читання і без кольорів.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'go-no-go',
    title: 'Go / No-Go',
    category: 'attention',
    description: 'Тисни на зелене коло, але стримайся, якщо з’явиться червоний квадрат.',
    status: 'available',
  },
  {
    id: 'card-sort',
    title: 'Сортування карток',
    category: 'attention',
    description: 'Розклади картки за кольором, а потім — за формою. Правило зміниться посеред гри.',
    status: 'available',
  },
  {
    id: 'subitizing',
    title: 'Субітизація',
    category: 'attention',
    description: 'За частку секунди оціни, скільки крапок з’явилось на екрані.',
    status: 'available',
  },
  {
    id: 'simon',
    title: 'Simon / Корсі',
    category: 'memory',
    description: 'Запам’ятай і повтори послідовність спалахів — щоразу вона стає на крок довшою.',
    status: 'available',
  },
  {
    id: 'memory-pairs',
    title: 'Знайди пару',
    category: 'memory',
    description: 'Відкривай картки по дві й запам’ятовуй, де яка фігура — знайди всі пари.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'quick-math',
    title: 'Швидкий рахунок',
    category: 'thinking',
    description: 'Розв’яжи якомога більше прикладів на час — обери правильну відповідь.',
    status: 'available',
  },
  {
    id: 'reaction-time',
    title: 'Швидкість реакції',
    category: 'reaction',
    description: 'Натисни, щойно екран стане зеленим. Не поспішай — передчасний клік не рахується.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'keyboard-trainer',
    title: 'Клавіатурний тренажер',
    // Не «увага», а «реакція»: тут вимірюється швидкість руху пальця до
    // потрібної клавіші, а не утримання уваги.
    category: 'reaction',
    description: 'Знайди на клавіатурі потрібну літеру. Підказка показує, де вона.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'n-back',
    title: 'N-back',
    category: 'memory',
    description: 'Натискай «Збіг!», коли поточна літера повторює ту, що була N кроків тому.',
    status: 'available',
  },
  {
    id: 'target-search',
    title: 'Пошук цілі',
    category: 'attention',
    description: 'Знайди серед фігур саме ту, що показана зверху як ціль.',
    status: 'available',
  },
  {
    id: 'matrices',
    title: 'Матриці',
    category: 'thinking',
    description:
      'Знайди закономірність у сітці 3×3 і вибери фігуру, яка має стояти замість знака питання.',
    status: 'available',
    beta: true,
  },
  {
    id: 'mental-rotation',
    title: 'Обертання фігур',
    category: 'thinking',
    description:
      'Визнач, чи друга фігура — це та сама, повернута під кутом, чи її дзеркальне відображення.',
    status: 'available',
    beta: true,
  },
  {
    id: 'traffic-light',
    title: 'Світлофор',
    category: 'reaction',
    description: 'Загоряється один із вогнів — натисни саме ту кнопку, що йому відповідає.',
    status: 'available',
  },
  {
    id: 'catch-the-moment',
    title: 'Лови момент',
    category: 'reaction',
    description: 'Бігунець мчить по смузі — зупини його точно в зеленій зоні.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'what-vanished',
    title: 'Що зникло',
    category: 'memory',
    description: 'Запам’ятай предмети — один зникне, і треба сказати, який саме.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'digit-span',
    title: 'Послідовність цифр',
    category: 'memory',
    description: 'Запам’ятай ряд цифр і повтори його — у тому самому або у зворотному порядку.',
    status: 'available',
  },
  {
    id: 'odd-one-out',
    title: 'Зайвий предмет',
    category: 'thinking',
    description: 'Три фігури схожі за однією ознакою, а одна — ні. Знайди зайву.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'continue-row',
    title: 'Продовж ряд',
    category: 'thinking',
    description: 'Фігури стоять за правилом — обери ту, що має бути наступною.',
    status: 'available',
  },
  {
    id: 'tower',
    title: 'Вежа',
    category: 'thinking',
    description: 'Переклади кульки так, як на зразку, — за найменшу кількість ходів. Спершу подумай.',
    status: 'available',
  },
  {
    id: 'number-line',
    title: 'Числова пряма',
    category: 'thinking',
    description: 'Покажи, де на прямій стоїть число. Тренує відчуття величини числа.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'emotions',
    title: 'Емоції',
    category: 'thinking',
    description: 'Впізнай, що відчуває людина, з виразу її обличчя — і що відчуваєш у різних ситуаціях.',
    status: 'available',
  },
  {
    id: 'rhythm',
    title: 'Ритм',
    category: 'speech',
    description: 'Послухай ритм і простукай його так само — коротко й довго, як було.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'first-sound',
    title: 'Перший звук',
    category: 'speech',
    description: 'Подивись на картинку і визнач, з якого звуку починається слово.',
    status: 'available',
  },
  {
    id: 'word-groups',
    title: 'Що до чого',
    category: 'speech',
    description: 'Визнач, до якої групи належить предмет: тварини, транспорт, їжа, інструменти.',
    status: 'available',
  },
  {
    id: 'graphic-dictation',
    title: 'Графічний диктант',
    category: 'space',
    description: 'Веди лінію клітинками за командами: стільки вправо, стільки вгору — і вийде візерунок.',
    status: 'available',
    freeForGuests: true,
  },
  {
    id: 'trace-path',
    title: 'Доріжка',
    category: 'space',
    description: 'Проведи пальцем або мишею доріжкою від старту до фінішу, не виходячи за краї.',
    status: 'available',
  },
]

/**
 * Назва, категорія й опис гри для її конфігу. Падає одразу, якщо гри тут
 * немає: тихий undefined у назві виявився б лише на екрані дитини.
 */
export function gameInfo(id) {
  const game = GAMES.find((entry) => entry.id === id)
  if (!game) throw new Error(`Гри «${id}» немає в src/data/games.js`)
  return { id: game.id, title: game.title, category: game.category, description: game.description }
}
