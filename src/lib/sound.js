import { getSettings } from './settings'

let audioContext = null

function getContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

function playTone({ frequency, duration = 0.09, type = 'sine', volume = 0.07 }) {
  const ctx = getContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + duration)
}

// Web Audio can throw in unsupported/locked-down environments (e.g. no user
// gesture yet). Sound is a non-essential enhancement, so failures are ignored.
function safePlay(tone) {
  if (!getSettings().soundEnabled) return

  try {
    playTone(tone)
  } catch {
    // ignore
  }
}

export function playClick() {
  safePlay({ frequency: 520, duration: 0.06, type: 'square', volume: 0.05 })
}

export function playCorrect() {
  safePlay({ frequency: 740, duration: 0.12, type: 'sine', volume: 0.07 })
}

export function playWrong() {
  safePlay({ frequency: 170, duration: 0.16, type: 'sawtooth', volume: 0.06 })
}

// A short major-chord arpeggio (C5-E5-G5-C6), distinct from the plain
// correct/click tones — reserved for personal bests and new achievements.
export function playVictory() {
  if (!getSettings().soundEnabled) return

  const ctx = getContext()
  if (!ctx) return

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    const noteDuration = 0.14
    const gap = 0.09

    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * gap
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.08, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration)

      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + noteDuration)
    })
  } catch {
    // ignore — sound is a non-essential enhancement
  }
}
