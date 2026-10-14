import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/*
 * Web Audio у jsdom немає, тож він підміняється рівно настільки, щоб було видно,
 * що саме код збирає: скільки джерел звуку створено, куди вони під'єднані і чи
 * зупинені. Перевіряється не звучання, а рішення.
 */
function makeAudioMock() {
  const started = []
  const stopped = []
  const gains = []
  const contexts = []

  class FakeParam {
    constructor() {
      this.value = 0
      this.calls = []
    }
    setValueAtTime(v) {
      this.value = v
      this.calls.push(['set', v])
    }
    exponentialRampToValueAtTime(v) {
      this.calls.push(['ramp', v])
    }
    cancelScheduledValues() {
      this.calls.push(['cancel'])
    }
    setTargetAtTime(v) {
      this.calls.push(['target', v])
    }
  }

  class FakeContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = { name: 'destination' }
      contexts.push(this)
    }
    resume() {}
    createOscillator() {
      const node = {
        type: 'sine',
        frequency: new FakeParam(),
        detune: new FakeParam(),
        connect: () => {},
        start: () => started.push(node),
        stop: () => stopped.push(node),
      }
      return node
    }
    createGain() {
      const node = { gain: new FakeParam(), connect: () => {} }
      gains.push(node)
      return node
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: new FakeParam(), connect: () => {} }
    }
  }

  return { FakeContext, started, stopped, gains, contexts }
}

let mock

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  mock = makeAudioMock()
  window.AudioContext = mock.FakeContext
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.AudioContext
})

async function load({ sensorySafe = false } = {}) {
  if (sensorySafe) {
    const { __setAdaptationsForTest } = await import('./adaptations')
    __setAdaptationsForTest({ sensorySafe: true })
  }
  return import('./sound')
}

function setMode(sound) {
  localStorage.setItem('inclusive-games:settings', JSON.stringify({ sound }))
}

describe('режими звуку', () => {
  it('у тиші клацання не звучить', async () => {
    setMode('off')
    const { playClick } = await load()

    playClick()

    expect(mock.started).toHaveLength(0)
  })

  it('у режимі клацання звучить', async () => {
    setMode('clicks')
    const { playClick } = await load()

    playClick()

    expect(mock.started).toHaveLength(1)
  })

  it('у тиші мовчить і нагорода', async () => {
    setMode('off')
    const { playVictory } = await load()

    playVictory()

    expect(mock.started).toHaveLength(0)
  })
})

describe('фонова музика', () => {
  it('у режимі клацання фону немає', async () => {
    setMode('clicks')
    const { startAmbient, isAmbientPlaying } = await load()

    startAmbient()

    expect(isAmbientPlaying()).toBe(false)
    expect(mock.started).toHaveLength(0)
  })

  it('у тиші фону немає', async () => {
    setMode('off')
    const { startAmbient, isAmbientPlaying } = await load()

    startAmbient()

    expect(isAmbientPlaying()).toBe(false)
  })

  it('у режимі музики фон запускається', async () => {
    setMode('music')
    const { startAmbient, isAmbientPlaying } = await load()

    startAmbient()

    expect(isAmbientPlaying()).toBe(true)
    expect(mock.started.length).toBeGreaterThan(1)
  })

  /**
   * Подвійний запуск лишив би другий набір генераторів грати вічно: зупинка
   * знає лише про останній.
   */
  it('другий запуск не додає ще одного шару', async () => {
    setMode('music')
    const { startAmbient } = await load()

    startAmbient()
    const afterFirst = mock.started.length
    startAmbient()

    expect(mock.started).toHaveLength(afterFirst)
  })

  it('зупинка глушить усі генератори', async () => {
    setMode('music')
    const { startAmbient, stopAmbient, isAmbientPlaying } = await load()

    startAmbient()
    const voices = mock.started.length
    stopAmbient()

    expect(isAmbientPlaying()).toBe(false)
    expect(mock.stopped).toHaveLength(voices)
  })

  it('зупинка без запуску нічого не ламає', async () => {
    setMode('music')
    const { stopAmbient } = await load()

    expect(() => stopAmbient()).not.toThrow()
  })

  /**
   * Різкий обрив звуку сам по собі смикає, тож гучність зводиться плавно.
   */
  it('фон згасає, а не обривається', async () => {
    setMode('music')
    const { startAmbient, stopAmbient } = await load()

    startAmbient()
    stopAmbient()

    const master = mock.gains.at(-1)
    expect(master.gain.calls.map(([kind]) => kind)).toContain('ramp')
  })

  it('після зупинки фон можна ввімкнути знову', async () => {
    setMode('music')
    const { startAmbient, stopAmbient, isAmbientPlaying } = await load()

    startAmbient()
    stopAmbient()
    startAmbient()

    expect(isAmbientPlaying()).toBe(true)
  })
})

describe('ігрові звуки', () => {
  it('«правильно» — дві ноти вгору', async () => {
    setMode('clicks')
    const { playCorrect } = await load()

    playCorrect()

    const [first, second] = mock.started.map((node) => node.frequency.calls[0][1])
    expect(mock.started).toHaveLength(2)
    expect(second).toBeGreaterThan(first)
  })

  it('помилка звичайно — «у-у» вниз, без зумера', async () => {
    setMode('clicks')
    const { playWrong } = await load()

    playWrong()

    const [first, second] = mock.started.map((node) => node.frequency.calls[0][1])
    expect(mock.started).toHaveLength(2)
    expect(second).toBeLessThan(first)
    expect(mock.started.every((node) => node.type !== 'sawtooth' && node.type !== 'square')).toBe(true)
  })

  it('у сенсорно-безпечному режимі помилка — один тихий тон', async () => {
    setMode('clicks')
    const { playWrong } = await load({ sensorySafe: true })

    playWrong()

    expect(mock.started).toHaveLength(1)
    expect(mock.started[0].type).toBe('sine')
  })

  it('фанфара — арпеджіо й акорд', async () => {
    setMode('clicks')
    const { playVictory } = await load()

    playVictory()
    expect(mock.started.length).toBeGreaterThan(4)
  })

  it('у сенсорному режимі фанфара мовчить', async () => {
    setMode('clicks')
    const { playVictory } = await load({ sensorySafe: true })

    playVictory()
    expect(mock.started).toHaveLength(0)
  })

  it('відлік звучить, а в тиші мовчить', async () => {
    setMode('clicks')
    const sound = await load()
    sound.playCountdownTick()
    sound.playGo()
    expect(mock.started).toHaveLength(2)

    mock.started.length = 0
    setMode('off')
    sound.playCountdownTick()
    sound.playGo()
    expect(mock.started).toHaveLength(0)
  })
})

describe('петля фонової музики', () => {
  it('акорди змінюються, а скринька дзенькає поверх', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    setMode('music')
    const { startAmbient } = await load()

    startAmbient()
    const voices = mock.started.length
    vi.advanceTimersByTime(4000)

    const glides = mock.started
      .slice(0, voices)
      .flatMap((node) => node.frequency.calls.filter(([kind]) => kind === 'target'))
    expect(glides.length).toBeGreaterThan(0)
    expect(mock.started.length).toBeGreaterThan(voices)
  })

  it('у сенсорному режимі лише рівний акорд синусоїдами, без раптових нот', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    setMode('music')
    const { startAmbient } = await load({ sensorySafe: true })

    startAmbient()
    const voices = mock.started.length
    vi.advanceTimersByTime(8000)

    expect(mock.started).toHaveLength(voices)
    expect(mock.started.every((node) => node.type === 'sine')).toBe(true)
  })

  /** Ноти, заплановані в приспаному контексті, пролунали б усі разом. */
  it('поки контекст чекає на дотик, нот не накопичується', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    setMode('music')
    const { startAmbient } = await load()

    startAmbient()
    mock.contexts[0].state = 'suspended'
    const voices = mock.started.length
    vi.advanceTimersByTime(8000)

    expect(mock.started).toHaveLength(voices)
  })

  it('після зупинки петля більше нічого не грає', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    setMode('music')
    const { startAmbient, stopAmbient } = await load()

    startAmbient()
    stopAmbient()
    const after = mock.started.length
    vi.advanceTimersByTime(8000)

    expect(mock.started).toHaveLength(after)
  })
})
