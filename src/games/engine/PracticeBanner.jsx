import SpeakButton from './SpeakButton'

/**
 * Смужка над пробною грою: що це за гра і що в ній робити.
 *
 * Правило висить увесь час, а не лише перед стартом, — це і є показ «як
 * грати»: дитина бачить підказку саме в ту мить, коли перед нею перша фігура, а
 * не згадує прочитане хвилину тому. Для тієї, що не читає, його промовляє голос.
 */
function PracticeBanner({ hint }) {
  return (
    <div className="game-shell__practice" role="note" aria-label="Пробна гра">
      <p className="game-shell__practice-title">
        <strong>Пробна гра</strong> — бали не рахуються
      </p>
      <p className="game-shell__practice-hint">{hint}</p>
      <SpeakButton text={hint} auto label="Послухати підказку" />
    </div>
  )
}

export default PracticeBanner
