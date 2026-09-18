import { supabase, isCloudConfigured } from './supabaseClient'

/**
 * Куди діваються падіння.
 *
 * Правило одне на весь файл: **звітування про помилку не має права впасти
 * саме**. Якщо воно впаде — а воно викликається саме тоді, коли все вже
 * погано, — ми отримаємо помилку в обробнику помилок, і дитина побачить
 * замість поламаної сторінки поламану сторінку без пояснень.
 *
 * Тому тут немає жодного await, який міг би відкинути обіцянку назовні, і
 * жодного звернення до сховища чи мережі без try.
 */

/* Межі з міграції. Обрізаємо на клієнті, щоб сервер не відхиляв запис цілком
   через кілька зайвих символів — краще коротший слід, ніж жодного. */
const MAX_MESSAGE = 2000
const MAX_STACK = 8000
const MAX_PATH = 500
const MAX_AGENT = 500

/*
 * Одне падіння в циклі малювання React повторює себе десятки разів на секунду.
 * Без стелі перша ж така помилка залила б таблицю тисячами однакових рядків за
 * хвилину — і вимкнула б корисність журналу саме тоді, коли він потрібен.
 */
const MAX_PER_SESSION = 10
const seen = new Set()
let sent = 0

function cut(value, limit) {
  if (typeof value !== 'string') return null
  return value.length > limit ? value.slice(0, limit) : value
}

/** Текст помилки з чого завгодно: кидають не лише Error. */
function messageOf(error) {
  // Кинуті null і undefined не несуть нічого: рядок «null» у журналі виглядає
  // як падіння, але не каже ні що впало, ні де.
  if (error === null || error === undefined) return null
  if (error instanceof Error) return error.message || error.name || 'Error'
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * @param error    те, що впало
 * @param kind     'render' — усередині React, 'window' — глобальна помилка,
 *                 'promise' — відкинута обіцянка без обробника
 * @param extra    додатковий слід (наприклад, componentStack від React)
 */
export function reportError(error, kind = 'window', extra = null) {
  try {
    const message = cut(messageOf(error), MAX_MESSAGE)
    if (!message) return

    /*
     * Ключ дедуплікації — вид плюс текст, без сліду стека: той самий збій із
     * різних місць усе одно та сама історія, а слід у нас уже є з першого разу.
     */
    const key = `${kind}:${message}`
    if (seen.has(key)) return
    if (sent >= MAX_PER_SESSION) return
    seen.add(key)
    sent += 1

    // Консоль — завжди, навіть без хмари: без неї розробник лишається сліпим
    // на власній машині.
    console.error('[inclusive-games]', kind, error)

    if (!isCloudConfigured) return

    const stack = cut(
      [error instanceof Error ? error.stack : null, extra].filter(Boolean).join('\n\n'),
      MAX_STACK,
    )

    void send({
      kind,
      message,
      stack,
      path: cut(safeLocation(), MAX_PATH),
      user_agent: cut(safeAgent(), MAX_AGENT),
    })
  } catch {
    // Обробник помилок, що кинув помилку, — найгірше, що тут може статися.
  }
}

async function send(row) {
  try {
    /*
     * Сесія читається, щоб підписати запис, але її відсутність нічого не
     * скасовує: падіння в гостя цікаве не менше, ніж падіння в учня.
     */
    let userId = null
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      userId = session?.user?.id ?? null
    } catch {
      userId = null
    }

    await supabase.from('client_errors').insert({ ...row, user_id: userId })
  } catch {
    // Мережі немає або таблиці ще немає — звіт про падіння не той привід,
    // щоб падати вдруге.
  }
}

function safeLocation() {
  try {
    return window.location.pathname + window.location.search
  } catch {
    return null
  }
}

function safeAgent() {
  try {
    return navigator.userAgent
  } catch {
    return null
  }
}

/**
 * Помилки поза React: ті, що виникли в обробнику події, у таймері або в
 * обіцянці без catch. Межа React їх не бачить узагалі.
 */
export function watchGlobalErrors() {
  try {
    window.addEventListener('error', (event) => {
      reportError(event.error ?? event.message, 'window')
    })
    window.addEventListener('unhandledrejection', (event) => {
      reportError(event.reason, 'promise')
    })
  } catch {
    // Середовище без window — нічого страшного, звітувати нема звідки.
  }
}

/** Лише для тестів: скидає стелю й пам'ять про вже надіслане. */
export function resetErrorLog() {
  seen.clear()
  sent = 0
}
