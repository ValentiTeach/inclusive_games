import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insert = vi.fn()
const getSession = vi.fn()

vi.mock('./supabaseClient', () => ({
  isCloudConfigured: true,
  supabase: {
    from: () => ({ insert: (...args) => insert(...args) }),
    auth: { getSession: (...args) => getSession(...args) },
  },
}))

const { reportError, resetErrorLog, watchGlobalErrors } = await import('./errorLog')

/** Чекає, поки відпрацюють обіцянки, які reportError навмисно не чекає. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('журнал падінь', () => {
  beforeEach(() => {
    resetErrorLog()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
    getSession.mockResolvedValue({ data: { session: null } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('надсилає падіння з текстом і слідом', async () => {
    reportError(new Error('дошка зламалася'), 'render', 'у грі «Зайвий предмет»')
    await settle()

    expect(insert).toHaveBeenCalledTimes(1)
    const row = insert.mock.calls[0][0]
    expect(row.message).toBe('дошка зламалася')
    expect(row.kind).toBe('render')
    expect(row.stack).toContain('у грі «Зайвий предмет»')
  })

  /**
   * Одне падіння в циклі малювання повторює себе десятки разів на секунду. Без
   * стелі перша ж така помилка залила б таблицю тисячами однакових рядків —
   * і вимкнула б корисність журналу саме тоді, коли він потрібен.
   */
  it('однакові падіння надсилає один раз', async () => {
    for (let i = 0; i < 20; i += 1) reportError(new Error('те саме'), 'render')
    await settle()

    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('різні падіння надсилає окремо', async () => {
    reportError(new Error('перше'), 'render')
    reportError(new Error('друге'), 'render')
    await settle()

    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('те саме падіння з різних місць рахується окремо за видом', async () => {
    reportError(new Error('те саме'), 'render')
    reportError(new Error('те саме'), 'promise')
    await settle()

    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('більше десяти різних падінь за сеанс не шле', async () => {
    for (let i = 0; i < 25; i += 1) reportError(new Error(`падіння ${i}`), 'render')
    await settle()

    expect(insert).toHaveBeenCalledTimes(10)
  })

  /**
   * Межі збігаються з тими, що в міграції: сервер відхилив би задовгий запис
   * цілком, а коротший слід кращий за жодного.
   */
  it('задовгий текст обрізає, а не втрачає запис', async () => {
    reportError(new Error('я'.repeat(5000)), 'render')
    await settle()

    expect(insert.mock.calls[0][0].message).toHaveLength(2000)
  })

  it('кидають не лише Error', async () => {
    reportError('просто рядок', 'window')
    await settle()

    expect(insert.mock.calls[0][0].message).toBe('просто рядок')
  })

  it('порожнє падіння не шле нічого', async () => {
    reportError(null, 'window')
    reportError(undefined, 'window')
    await settle()

    expect(insert).not.toHaveBeenCalled()
  })

  it('падіння гостя підписує порожнім користувачем, а не пропускає', async () => {
    reportError(new Error('у гостя'), 'render')
    await settle()

    expect(insert.mock.calls[0][0].user_id).toBeNull()
  })

  it('падіння учня підписує ним', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'child-1' } } } })
    reportError(new Error('в учня'), 'render')
    await settle()

    expect(insert.mock.calls[0][0].user_id).toBe('child-1')
  })

  /**
   * Головне правило всього файлу: звітування викликається тоді, коли все вже
   * погано. Помилка в обробнику помилок — найгірше, що тут може статися.
   */
  /**
   * Не просто «не кидає синхронно»: відправка не має лишити по собі відкинуту
   * обіцянку без обробника. Така обіцянка спрацьовує як подія
   * unhandledrejection — а її ловить наш власний глобальний слухач і йде
   * звітувати про звіт. Стеля й дедуплікація цей цикл обірвуть, але кількох
   * зайвих кіл на вже поламаній сторінці не має бути взагалі.
   */
  it('невдала відправка не лишає відкинутої обіцянки', async () => {
    insert.mockRejectedValue(new Error('мережі немає'))
    const loose = []
    const catcher = (reason) => loose.push(reason)
    process.on('unhandledRejection', catcher)

    try {
      expect(() => reportError(new Error('перше'), 'render')).not.toThrow()
      await settle()
      await settle()
    } finally {
      process.off('unhandledRejection', catcher)
    }

    expect(loose).toEqual([])
  })

  it('не падає, коли не читається сесія', async () => {
    getSession.mockRejectedValue(new Error('сховище закрите'))

    expect(() => reportError(new Error('перше'), 'render')).not.toThrow()
    await settle()
    expect(insert.mock.calls[0][0].user_id).toBeNull()
  })

  it('пише в консоль навіть тоді, коли надіслати не вийде', async () => {
    insert.mockRejectedValue(new Error('мережі немає'))
    reportError(new Error('видиме розробнику'), 'render')
    await settle()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('помилки поза React', () => {
  beforeEach(() => {
    resetErrorLog()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
    getSession.mockResolvedValue({ data: { session: null } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ловить помилку в обробнику події', async () => {
    watchGlobalErrors()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('у таймері') }))
    await settle()

    expect(insert.mock.calls[0][0]).toMatchObject({ kind: 'window', message: 'у таймері' })
  })

  it('ловить обіцянку без обробника', async () => {
    watchGlobalErrors()
    const event = new Event('unhandledrejection')
    event.reason = new Error('запит нікуди не дійшов')
    window.dispatchEvent(event)
    await settle()

    expect(insert.mock.calls[0][0]).toMatchObject({ kind: 'promise' })
  })
})
