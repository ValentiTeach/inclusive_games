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
    // Без дотику дитини браузер може відмовити; тоді просто чекаємо наступного.
    Promise.resolve(audioContext.resume()).catch(() => {})
  }
  return audioContext
}

/*
 * Один тон. Кожен ігровий звук нижче складено з таких: `endFrequency` дає
 * ковзання висоти («поп», «у-у»), `delay` — місце тону в короткій мелодії.
 * Наростання за 8 мс замість миттєвого старту: інакше динамік клацає.
 */
function playTone({ frequency, endFrequency, duration = 0.09, type = 'sine', volume = 0.07, delay = 0 }) {
  const ctx = getContext()
  if (!ctx) return

  const start = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  }
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
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
function safePlay(tones) {
  if (!soundOn()) return

  try {
    const list = Array.isArray(tones) ? tones : [tones]
    list.forEach((tone) => playTone(soften(tone)))
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

/*
 * Звуки ігрові, але всі синтезовані тут же, з простих тонів: жодного чужого
 * запису чи впізнаваної мелодії з відомої гри, тож і питань про авторські права
 * немає. Короткі інтервали (квінта, терція, арпеджіо мажору) — загальне місце
 * музики, а не чийсь твір.
 */

/** «Поп» — короткий звук натискання, що падає вниз, як бульбашка. */
export function playClick() {
  safePlay({ frequency: 880, endFrequency: 520, duration: 0.06, type: 'triangle', volume: 0.06 })
}

/** «Дзень-дзелень» — дві ноти вгору на квінту: правильно! */
export function playCorrect() {
  safePlay([
    { frequency: 659.25, duration: 0.09, type: 'triangle', volume: 0.07 },
    { frequency: 987.77, duration: 0.18, type: 'triangle', volume: 0.07, delay: 0.07 },
  ])
}

export function playWrong() {
  wrongListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Слухач — прикраса; гра не має падати через нього.
    }
  })

  // М'яка реакція: замість «у-у» — один тихий тон, що трохи сповзає вниз. Він
  // каже «ні», але не лякає. Неприємний звук за помилку для тривожної дитини —
  // покарання.
  if (errorFeedbackMode() === 'gentle') {
    safePlay({ frequency: 392, endFrequency: 330, duration: 0.18, type: 'sine', volume: 0.035 })
    return
  }
  // Ігрове «у-у»: дві ноти вниз, кожна з'їжджає. Ясно, що не так, але без зумера.
  safePlay([
    { frequency: 311.13, endFrequency: 277.18, duration: 0.12, type: 'triangle', volume: 0.08 },
    { frequency: 233.08, endFrequency: 196, duration: 0.22, type: 'triangle', volume: 0.08, delay: 0.13 },
  ])
}

/**
 * Відлік перед грою: «тік» на кожне число і ковзання вгору на «Старт!».
 * У сенсорно-безпечному режимі тони пом'якшуються, як і всі інші.
 */
export function playCountdownTick() {
  safePlay({ frequency: 587.33, duration: 0.08, type: 'sine', volume: 0.06 })
}

export function playGo() {
  safePlay({ frequency: 523.25, endFrequency: 1046.5, duration: 0.22, type: 'triangle', volume: 0.07 })
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

/*
 * Фанфара для особистого рекорду й нового досягнення: швидке арпеджіо до-мажору
 * вгору і акорд, що дзвенить наостанок. Окремо від звичайного «правильно», щоб
 * рекорд звучав як подія.
 */
const VICTORY_RUN = [392, 523.25, 659.25, 783.99]
const VICTORY_CHORD = [523.25, 659.25, 783.99, 1046.5]

export function playVictory() {
  if (!soundOn()) return
  // Фанфара — саме той раптовий звук, від якого сенсорний режим береже.
  if (getActiveAdaptations().sensorySafe) return

  const step = 0.08
  safePlay([
    ...VICTORY_RUN.map((frequency, index) => ({
      frequency,
      duration: 0.12,
      type: 'triangle',
      volume: 0.07,
      delay: index * step,
    })),
    ...VICTORY_CHORD.map((frequency) => ({
      frequency,
      duration: 0.6,
      type: 'triangle',
      volume: 0.035,
      delay: VICTORY_RUN.length * step,
    })),
  ])
}

/* ───────────────────────── Фонова музика ─────────────────────────
 *
 * Для частини дітей тиша — умова, за якої вони взагалі можуть займатися, для
 * інших порожній звуковий фон сам стає відволіканням. Тому це третій режим, а
 * не ще один перемикач: «тихо», «клацання», «музика».
 *
 * Музика синтезується, а не програється файлом: жодного завантаження, працює
 * без мережі, не додає мегабайтів до застосунку, який ставлять на телефон, — і
 * не належить нікому, крім проєкту.
 *
 * Це спокійна петля, як у меню гри: м'який акорд повільно перетікає по колу з
 * чотирьох (до — ля мінор — фа — соль), а зверху зрідка дзенькає «музична
 * скринька» — нота з того самого акорду, щоразу інша. Чіткої мелодії, за якою
 * хотілося б стежити, немає: увага тут потрібна грі.
 *
 * Голоси тримають спільні ноти й рухаються щонайбільше на тон, тож акорди
 * зливаються, а не перемикаються.
 */
let ambient = null

const AMBIENT_CHORDS = [
  [261.63, 329.63, 392.0], // до мажор: C4 E4 G4
  [261.63, 329.63, 440.0], // ля мінор: C4 E4 A4
  [261.63, 349.23, 440.0], // фа мажор: C4 F4 A4
  [246.94, 293.66, 392.0], // соль мажор: B3 D4 G4
]

// Кожен акорд звучить два кроки; на кожному кроці може дзенькнути скринька.
const AMBIENT_STEP_MS = 2000
const STEPS_PER_CHORD = 2
const SPARKLE_CHANCE = 0.6

function playSparkle(state, chord) {
  const { ctx, master } = state
  const frequency = chord[Math.floor(Math.random() * chord.length)] * 2
  const start = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)

  oscillator.connect(gain)
  gain.connect(master)
  oscillator.start(start)
  oscillator.stop(start + 1.5)
}

function ambientStep(state) {
  const { ctx, voices, sensorySafe } = state
  // Контекст ще чекає на перший дотик дитини: ноти, заплановані зараз, у ньому
  // накопичилися б і пролунали всі разом, щойно він прокинеться.
  if (ctx.state !== 'running') return

  state.step += 1
  const chord = AMBIENT_CHORDS[Math.floor(state.step / STEPS_PER_CHORD) % AMBIENT_CHORDS.length]

  if (state.step % STEPS_PER_CHORD === 0) {
    voices.forEach((oscillator, index) => {
      // Плавне ковзання до нової ноти замість стрибка.
      oscillator.frequency.setTargetAtTime(chord[index], ctx.currentTime, 0.35)
    })
  }

  // Сенсорно-безпечний режим лишає тільки рівний акорд, без раптових нот.
  if (!sensorySafe && Math.random() < SPARKLE_CHANCE) {
    playSparkle(state, chord)
  }
}

export function startAmbient() {
  if (getSettings().sound !== 'music') return
  if (ambient) return

  try {
    const ctx = getContext()
    if (!ctx) return

    const sensorySafe = getActiveAdaptations().sensorySafe

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900

    const voices = AMBIENT_CHORDS[0].map((frequency) => {
      const oscillator = ctx.createOscillator()
      const voiceGain = ctx.createGain()
      // Трикутник тепліший за чисту синусоїду, а фільтр знімає його гостроту.
      oscillator.type = sensorySafe ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
      voiceGain.gain.value = 0.33
      oscillator.connect(voiceGain)
      voiceGain.connect(filter)
      oscillator.start()
      return oscillator
    })

    const master = ctx.createGain()
    // Тихо настільки, щоб не перебивати ні звуки гри, ні голос поруч.
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 2)

    filter.connect(master)
    master.connect(ctx.destination)

    const state = { ctx, master, filter, voices, sensorySafe, step: 0, timer: null }
    state.timer = setInterval(() => {
      try {
        ambientStep(state)
      } catch {
        // Музика — прикраса; збій кроку не має зупиняти гру.
      }
    }, AMBIENT_STEP_MS)

    ambient = state
  } catch {
    ambient = null
  }
}

export function stopAmbient() {
  if (!ambient) return

  const { ctx, master, voices, timer } = ambient
  ambient = null
  clearInterval(timer)

  try {
    // Згасання, а не обрив: різкий кінець звуку сам по собі смикає.
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    voices.forEach((oscillator) => oscillator.stop(ctx.currentTime + 0.7))
  } catch {
    // Контекст міг уже закритися разом із вкладкою.
  }
}

/** Чи звучить фон просто зараз — для тестів і для перевірки стану. */
export function isAmbientPlaying() {
  return ambient !== null
}
