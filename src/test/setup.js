import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

// The games use Web Audio for feedback sounds; jsdom has no implementation and
// every play* call would otherwise throw inside components under test.
globalThis.AudioContext = class {
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {} }, type: '' }
  }
  createGain() {
    return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }
  }
  get currentTime() {
    return 0
  }
  get destination() {
    return {}
  }
  close() {}
}
