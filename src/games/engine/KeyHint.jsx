import './KeyHint.css'

/**
 * Рядок «якими клавішами в це грати».
 *
 * Стоїть і на екрані перед грою, і під ігровим полем — з однієї й тієї самої
 * `config.keyHint`. Підказка, яку видно лише до старту, для дитини під таймером
 * не існує; підказка, яку видно лише під час гри, приходить запізно.
 */
function KeyHint({ hint }) {
  if (!hint) return null

  return (
    <p className="key-hint">
      <kbd className="key-hint__keys">{hint.keys}</kbd>
      <span className="key-hint__text">{hint.text}</span>
    </p>
  )
}

export default KeyHint
