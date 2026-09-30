import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { getSettings } from '../../lib/settings'
import { speak, stopSpeaking, useUkrainianVoice } from '../../lib/speech'
import './SpeakButton.css'

/**
 * «Послухати» — інструкція голосом.
 *
 * Кнопки немає, коли на пристрої немає українського голосу або озвучення
 * вимкнено в налаштуваннях: кнопка, що нічого не робить або читає українське
 * англійським голосом, гірша за її відсутність.
 *
 * `auto` — текст, який варто промовити й без натискання, якщо дорослий обрав
 * в налаштуваннях «Автоматично». Для дитини, яка не читає, це різниця між
 * «попроси когось прочитати» і «гра пояснює сама».
 */
function SpeakButton({ text, auto = false, label = 'Послухати' }) {
  const voice = useUkrainianVoice()
  const mode = getSettings().voice
  const [speaking, setSpeaking] = useState(false)
  const available = Boolean(voice) && mode !== 'off'
  const autoPlay = available && auto && mode === 'auto'

  /*
   * Стан «говорить» ставиться з подій самого мовлення, а не тут: мовлення
   * може й не початися (браузер відмовив, голос зник), і тоді кнопка не має
   * вдавати, що говорить.
   */
  useEffect(() => {
    if (!autoPlay) return undefined
    speak(text, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) })
    return undefined
  }, [autoPlay, text])

  // Пішли з екрана — голос замовкає. Інакше інструкція до гри, з якої дитина
  // вже вийшла, звучала б поверх наступної сторінки.
  useEffect(() => () => stopSpeaking(), [])

  if (!available) return null

  function handleClick() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    speak(text, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) })
  }

  return (
    <button type="button" className="speak-button" onClick={handleClick} aria-pressed={speaking}>
      {speaking ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      {speaking ? 'Зупинити' : label}
    </button>
  )
}

export default SpeakButton
