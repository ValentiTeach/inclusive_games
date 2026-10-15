import { CATEGORIES, GAMES } from './games'

/**
 * Назва й опис кожної сторінки — для вкладки браузера, пошуковика й картки
 * посилання у Viber, Telegram чи Facebook.
 *
 * Одне джерело для двох місць:
 *
 * - **У браузері** Layout ставить title, description, canonical і og:* під
 *   поточну адресу (lib/pageMeta.js). Без цього кожна вкладка називалася
 *   однаково, а закладка на «Таблиці Шульте» — «Inclusive Games».
 * - **Під час збірки** vite.config.js пише для кожної публічної сторінки
 *   окремий dist/<шлях>/index.html з уже підставленими тегами, sitemap.xml і
 *   robots.txt. Месенджери й соцмережі JavaScript не виконують: картку
 *   посилання вони складають з того HTML, який прийшов, — і досі це був
 *   один-єдиний index.html на всі адреси.
 *
 * Файл навмисно чисті дані: його імпортує й vite.config.js у Node.
 */

export const SITE_NAME = 'Inclusive Games'
export const DEFAULT_SITE_URL = 'https://inclusive-games.vercel.app'
export const OG_IMAGE = '/og-image.png'

const DEFAULT_DESCRIPTION =
  'Короткі ігри-вправи на увагу, пам’ять, мислення, слух, простір і саморегуляцію для дітей. Для уроку, заняття з фахівцем і дому — з адаптаціями для дітей з особливими потребами.'

/*
 * Сторінки з особистими даними або з дією, а не змістом. Пошуковику тут нема
 * чого показувати, і посилання на них не мають з'являтися у видачі.
 */
export const PRIVATE_PREFIXES = [
  '/groups',
  '/admin',
  '/child',
  '/session',
  '/join',
  '/account',
  '/login',
  '/progress',
  '/settings',
]

const STATIC_PAGES = {
  '/': {
    title: 'Inclusive Games — когнітивні ігри для дітей',
    description: DEFAULT_DESCRIPTION,
  },
  '/games': {
    title: 'Каталог ігор',
    description: `Усі ігри платформи за навичками: ${Object.values(CATEGORIES)
      .map((category) => category.label.toLowerCase())
      .join(', ')}. Кожна — окрема вправа на кілька хвилин.`,
  },
  '/help': {
    title: 'Довідка',
    description:
      'Як почати вчителю, дитині й батькам, що означає кожен показник, як налаштувати адаптації й додати український голос.',
  },
  '/accessibility': {
    title: 'Доступність',
    description:
      'Що зроблено для доступності: клавіатура, одна кнопка, озвучення, шрифт для дислексії, без поспіху — і чого ще бракує.',
  },
  '/privacy': {
    title: 'Дані та приватність',
    description:
      'Що платформа знає про дитину, хто бачить результати, скільки вони зберігаються і як їх видалити.',
  },
  '/privacy/consent': {
    title: 'Бланк згоди батьків',
    description: 'Бланк згоди на обробку даних дитини для друку.',
  },
  '/feedback': {
    title: 'Повідомити про проблему',
    description: 'Напишіть, якщо щось не працює, незручно або бракує гри.',
  },
  '/print/observation': {
    title: 'Бланк спостереження',
    description: 'Порожній бланк спостереження за дитиною під час заняття — для друку.',
  },
  '/print/cards': {
    title: 'Картки ігор',
    description: 'Картки ігор з правилами — для заняття без комп’ютера.',
  },
}

const PRIVATE_TITLES = {
  '/groups': 'Мої групи',
  '/admin': 'Адмін-панель',
  '/child': 'Моя дитина',
  '/session': 'Заняття',
  '/join': 'Приєднатися до групи',
  '/account': 'Акаунт',
  '/login': 'Вхід',
  '/progress': 'Мій прогрес',
  '/settings': 'Налаштування',
}

/*
 * «Гра на …» вимагає знахідного відмінка: «на увагу», а не «на увага». Підпис
 * категорії в називному, тож форма — окремо, і тест стежить, щоб кожна нова
 * категорія приходила зі своєю.
 */
export const CATEGORY_ACCUSATIVE = {
  attention: 'увагу',
  memory: 'пам’ять',
  thinking: 'мислення',
  reaction: 'реакцію',
  speech: 'слух і мовлення',
  space: 'простір і рух',
  regulation: 'саморегуляцію',
}

function gamePage(game) {
  return {
    title: `${game.title} — гра на ${CATEGORY_ACCUSATIVE[game.category] ?? CATEGORIES[game.category].label.toLowerCase()}`,
    description: game.description,
  }
}

/** Повна назва для вкладки: «Довідка — Inclusive Games», головна — як є. */
export function fullTitle(title) {
  return title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`
}

export function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * Мета для адреси. Невідома адреса отримує загальний опис і noindex: краще
 * не показати нічого, ніж показати «Сторінку не знайдено» у видачі.
 */
export function pageMetaFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  if (STATIC_PAGES[path]) {
    return { ...STATIC_PAGES[path], title: fullTitle(STATIC_PAGES[path].title), path, index: true }
  }

  const gameMatch = path.match(/^\/games\/([^/]+)$/)
  if (gameMatch) {
    const game = GAMES.find((entry) => entry.id === gameMatch[1])
    if (game) return { ...gamePage(game), title: fullTitle(gamePage(game).title), path, index: true }
  }

  const prefix = PRIVATE_PREFIXES.find(
    (entry) => path === entry || path.startsWith(`${entry}/`),
  )
  return {
    title: fullTitle(PRIVATE_TITLES[prefix] ?? 'Сторінку не знайдено'),
    description: DEFAULT_DESCRIPTION,
    path,
    index: false,
  }
}

/** Публічні сторінки — для sitemap.xml і окремих HTML під час збірки. */
export function publicPaths() {
  return [
    ...Object.keys(STATIC_PAGES),
    ...GAMES.filter((game) => game.status !== 'hidden').map((game) => `/games/${game.id}`),
  ]
}

function escapeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function sitemapXml(siteUrl, lastmod) {
  const urls = publicPaths()
    .map(
      (path) =>
        `  <url><loc>${escapeXml(siteUrl + path)}</loc><lastmod>${lastmod}</lastmod></url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function robotsTxt(siteUrl) {
  return [
    'User-agent: *',
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

/**
 * Підставляє мету сторінки в готовий index.html. Теги шукаються за атрибутом,
 * а не за порядком, тож перестановка рядків в index.html нічого не ламає; а
 * тег, якого не знайдено, — помилка збірки, а не тиха картка без назви.
 */
export function renderHtmlMeta(html, meta, siteUrl) {
  const url = siteUrl + (meta.path === '/' ? '/' : meta.path)
  const image = siteUrl + OG_IMAGE
  const description = escapeXml(meta.description)
  const title = escapeXml(meta.title)

  const attr = (name, kind = 'property') =>
    new RegExp(`(${kind}="${name}"\\s+content=")[^"]*(")`)
  // Значення — як є, без підстановок «$1»: опис гри міг би містити «$», і
  // String.replace прочитав би його як посилання на групу.
  const replacements = [
    [/(<title>)[^<]*(<\/title>)/, title],
    [attr('description', 'name'), description],
    [/(rel="canonical"\s+href=")[^"]*(")/, url],
    [attr('og:title'), title],
    [attr('og:description'), description],
    [attr('og:url'), url],
    [attr('og:image'), image],
    [attr('twitter:title', 'name'), title],
    [attr('twitter:description', 'name'), description],
    [attr('twitter:image', 'name'), image],
  ]

  let out = html
  for (const [pattern, value] of replacements) {
    if (!pattern.test(out)) throw new Error(`index.html: не знайдено ${pattern}`)
    out = out.replace(pattern, (_, before, after) => before + value + after)
  }
  return out
}
