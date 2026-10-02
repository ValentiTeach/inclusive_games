import { getSettings, errorFeedbackMode } from './settings'
import { getActiveAdaptations } from './adaptations'

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

/** Чи звучить зараз бодай щось. */
function soundOn() {
  return getSettings().sound !== 'off'
}

/*
 * Сенсорно-безпечний режим (профіль від фахівця): жодного різкого тембру.
 * Квадрат і пилка звучать як зумер — їх замінює синусоїда, і все тихіше
 * вдвічі. Звук не зникає зовсім: тиша — це окремий вибір «Тихо».
 */
function soften(tone) {
  if (!getActiveAdaptations().sensorySafe) return tone
  return { ...tone, type: 'sine', volume: tone.volume * 0.5 }
}

// Web Audio can throw in unsupported/locked-down environments (e.g. no user
// gesture yet). Sound is a non-essential enhancement, so failures are ignored.
function safePlay(tone) {
  if (!soundOn()) return

  try {
    playTone(soften(tone))
  } catch {
    // ignore
  }
}

/*
 * Помилка — це подія, яку бачить не лише динамік. Оболонка гри слухає її, щоб
 * у м'якому режимі показати спокійне «Спробуй ще» замість самого червоного.
 * Усі ігри вже кличуть playWrong на помилці, тож жодну не довелося правити.
 */
const wrongListeners = new Set()

export function onWrongAnswer(listener) {
  wrongListeners.add(listener)
  return () => wrongListeners.delete(listener)
}

export function playClick() {
  safePlay({ frequency: 520, duration: 0.06, type: 'square', volume: 0.05 })
}

export function playCorrect() {
  safePlay({ frequency: 740, duration: 0.12, type: 'sine', volume: 0.07 })
}

export function playWrong() {
  wrongListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Слухач — прикраса; гра не має падати через нього.
    }
  })

  // М'яка реакція: замість зумера — тихий низький тон, який каже «ні», але
  // не лякає. Неприємний звук за помилку для тривожної дитини — покарання.
  if (errorFeedbackMode() === 'gentle') {
    safePlay({ frequency: 330, duration: 0.14, type: 'sine', volume: 0.035 })
    return
  }
  safePlay({ frequency: 170, duration: 0.16, type: 'sawtooth', volume: 0.06 })
}

/**
 * Удар ритму. Звучить окремо від «клацань»: для гри «Ритм» звук — це сам
 * стимул, а не прикраса, тож гра сама вирішує, що робити, коли звук вимкнено
 * (див. isSoundOn), а тут лише граємо, якщо можна.
 *
 * `own` — удар самої дитини: нижчий і коротший, щоб її простукування не
 * зливалося з тим, що вона слухала.
 */
export function playBeat({ own = false } = {}) {
  safePlay(
    own
      ? { frequency: 520, duration: 0.08, type: 'triangle', volume: 0.07 }
      : { frequency: 880, duration: 0.12, type: 'triangle', volume: 0.09 },
  )
}

export function isSoundOn() {
  return soundOn()
}

// A short major-chord arpeggio (C5-E5-G5-C6), distinct from the plain
// correct/click tones — reserved for personal bests and new achievements.
export function playVictory() {
  if (!soundOn()) return
  // Арпеджіо — саме той раптовий звук, від якого сенсорний режим береже.
  if (getActiveAdaptations().sensorySafe) return

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

/* ───────────────────────── Фонова музика ─────────────────────────
 *
 * Для частини дітей тиша — умова, за якої вони взагалі можуть займатися, для
 * інших порожній звуковий фон сам стає відволіканням. Тому це третій режим, а
 * не ще один перемикач: «тихо», «клацання», «музика».
 *
 * Музика синтезується, а не програється файлом: жодного завантаження, працює
 * без мережі й не додає мегабайтів до застосунку, який ставлять на телефон.
 *
 * Це навмисно не мелодія. Дві майже однакові ноти в терцію, повільно пливуть
 * одна повз одну — рівний фон без подій, за яким немає чого стежити. Мелодія
 * тягла б увагу на себе, а увага тут потрібна грі.
 */
let ambient = null

const AMBIENT_VOICES = [
  { frequency: 174.61, detune: 0 },
  { frequency: 174.61, detune: 7 },
  { frequency: 261.63, detune: -5 },
]

export function startAmbient() {
  if (getSettings().sound !== 'music') return
  if (ambient) return

  try {
    const ctx = getContext()
    if (!ctx) return

    const master = ctx.createGain()
    // Тихо настільки, щоб не перебивати ні клацання гри, ні голос поруч.
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 2)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700

    const oscillators = AMBIENT_VOICES.map(({ frequency, detune }) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune
      oscillator.connect(filter)
      oscillator.start()
      return oscillator
    })

    filter.connect(master)
    master.connect(ctx.destination)

    ambient = { ctx, master, filter, oscillators }
  } catch {
    ambient = null
  }
}

export function stopAmbient() {
  if (!ambient) return

  const { ctx, master, oscillators } = ambient
  ambient = null

  try {
    // Згасання, а не обрив: різкий кінець звуку сам по собі смикає.
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    oscillators.forEach((oscillator) => oscillator.stop(ctx.currentTime + 0.7))
  } catch {
    // Контекст міг уже закритися разом із вкладкою.
  }
}

/** Чи звучить фон просто зараз — для тестів і для перевірки стану. */
export function isAmbientPlaying() {
  return ambient !== null
}
