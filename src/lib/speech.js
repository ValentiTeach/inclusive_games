import { useEffect, useState } from 'react'

/**
 * Озвучення інструкцій голосом пристрою.
 *
 * Три рядки тексту перед грою — це бар'єр для дитини, яка ще не читає, читає
 * повільно, має дислексію чи слабкий зір. Для інклюзивної платформи інструкція,
 * яку можна лише прочитати, — це інструкція не для всіх.
 *
 * Голос береться з браузера (Web Speech API), а не з записаних файлів: так
 * озвучується будь-який текст, включно з тим, що зміниться завтра, і офлайн
 * працює без жодного кешу.
 *
 * Лише український голос. Англійський голос, якому дали український текст,
 * читає його як набір незнайомих літер — це гірше, ніж тиша. Тому, коли
 * українського голосу на пристрої немає, кнопки просто не зʼявляються, а
 * сторінка налаштувань пояснює, як його додати.
 */

export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

export function findUkrainianVoice(voices) {
  const ukrainian = (voices ?? []).filter((voice) =>
    voice.lang?.toLowerCase().replace('_', '-').startsWith('uk'),
  )
  // Локальний голос працює без мережі й не обривається на півслові, коли
  // шкільний Wi-Fi зникає, — тому він у пріоритеті перед мережевим.
  return ukrainian.find((voice) => voice.localService) ?? ukrainian[0] ?? null
}

function currentVoice() {
  if (!isSpeechSupported()) return null
  return findUkrainianVoice(window.speechSynthesis.getVoices())
}

/*
 * Трохи повільніше за звичайне мовлення: інструкцію слухає дитина, і часто
 * саме та, якій швидкий текст важко встигнути зрозуміти.
 */
const RATE = 0.9

/**
 * Промовляє текст. Попереднє мовлення обривається: два голоси одночасно — це
 * шум, а не інструкція. `onEnd` викликається і тоді, коли мовлення перервали.
 * Повертає false, коли говорити нічим.
 */
export function speak(text, { onStart, onEnd } = {}) {
  const voice = currentVoice()
  if (!voice || !text) return false

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = RATE
  if (onStart) utterance.onstart = onStart
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  synth.speak(utterance)
  return true
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

/**
 * Український голос пристрою або null.
 *
 * Браузери вантажать список голосів не одразу: у Chrome перший getVoices()
 * часто повертає порожній масив, а справжній список приходить подією
 * `voiceschanged`. Тому це хук, а не одноразова перевірка.
 */
export function useUkrainianVoice() {
  const [voice, setVoice] = useState(() => currentVoice())

  useEffect(() => {
    if (!isSpeechSupported()) return undefined

    const synth = window.speechSynthesis
    const update = () => setVoice(currentVoice())
    synth.addEventListener?.('voiceschanged', update)
    return () => synth.removeEventListener?.('voiceschanged', update)
  }, [])

  return voice
}
