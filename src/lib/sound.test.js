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
  }

  class FakeContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = { name: 'destination' }
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

  return { FakeContext, started, stopped, gains }
}

let mock

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  mock = makeAudioMock()
  window.AudioContext = mock.FakeContext
})

afterEach(() => {
  delete window.AudioContext
})

async function load() {
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
