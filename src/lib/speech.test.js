import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { findUkrainianVoice, speak, stopSpeaking } from './speech'

const UK_LOCAL = { name: 'Lesya', lang: 'uk-UA', localService: true }
const UK_NET = { name: 'Google українська', lang: 'uk_UA', localService: false }
const EN = { name: 'Samantha', lang: 'en-US', localService: true }

describe('вибір голосу', () => {
  it('немає українського — немає голосу, а не англійський замість нього', () => {
    expect(findUkrainianVoice([EN])).toBeNull()
    expect(findUkrainianVoice([])).toBeNull()
    expect(findUkrainianVoice(undefined)).toBeNull()
  })

  it('впізнає мову і з дефісом, і з підкресленням', () => {
    expect(findUkrainianVoice([EN, UK_NET])).toBe(UK_NET)
  })

  it('локальний голос важить більше за мережевий: він не обривається без Wi-Fi', () => {
    expect(findUkrainianVoice([UK_NET, EN, UK_LOCAL])).toBe(UK_LOCAL)
  })
})

describe('промовляння', () => {
  let spoken

  beforeEach(() => {
    spoken = []
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text
      }
    }
    window.speechSynthesis = {
      voices: [EN, UK_LOCAL],
      getVoices() {
        return this.voices
      },
      speak: (utterance) => spoken.push(utterance),
      cancel: vi.fn(),
    }
  })

  afterEach(() => {
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })

  it('говорить українським голосом і трохи повільніше', () => {
    expect(speak('Натисни на зелене коло')).toBe(true)
    expect(spoken).toHaveLength(1)
    expect(spoken[0].voice).toBe(UK_LOCAL)
    expect(spoken[0].lang).toBe('uk-UA')
    expect(spoken[0].rate).toBeLessThan(1)
  })

  it('обриває попереднє мовлення, щоб не звучало два голоси', () => {
    speak('перше')
    speak('друге')
    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
  })

  it('мовчить, коли українського голосу немає', () => {
    window.speechSynthesis.voices = [EN]
    expect(speak('текст')).toBe(false)
    expect(spoken).toHaveLength(0)
  })

  it('не падає там, де браузер не вміє говорити', () => {
    delete window.speechSynthesis
    expect(speak('текст')).toBe(false)
    expect(() => stopSpeaking()).not.toThrow()
  })
})
