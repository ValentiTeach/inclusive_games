import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { isCloudConfigured } from '../lib/supabaseClient'
import {
  CONTACT_MAX,
  FEEDBACK_ERROR,
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  sendFeedback,
} from '../lib/serviceLog'
import Button from '../components/ui/Button'
import PrivacyContact from '../components/ui/PrivacyContact'
import { PRIVACY_CONTACT } from '../lib/privacy'
import { useT } from '../i18n/i18n'
import './DocPage.css'
import './Feedback.css'

const ERROR_KEYS = {
  [FEEDBACK_ERROR.EMPTY]: 'feedback.error.empty',
  [FEEDBACK_ERROR.TOO_MANY]: 'feedback.error.tooMany',
  [FEEDBACK_ERROR.UNAVAILABLE]: 'feedback.error.unavailable',
  [FEEDBACK_ERROR.UNKNOWN]: 'feedback.error.unknown',
}

/**
 * «Повідомити про проблему / ідею».
 *
 * Досі вчителька могла лише зателефонувати через тиждень і сказати «щось не
 * працює». Форма запам'ятовує сторінку, з якої людина прийшла (Footer передає
 * її в state), і версію сайту — це половина відповіді на «що саме».
 */
function Feedback() {
  const t = useT()
  const location = useLocation()
  const [params] = useSearchParams()
  const initialKind = FEEDBACK_KINDS[params.get('kind')] ? params.get('kind') : 'problem'
  const fromPath = location.state?.from ?? null

  const [kind, setKind] = useState(initialKind)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendFeedback({ kind, message, contact, fromPath })
      setSent(true)
    } catch (caught) {
      setError(t(ERROR_KEYS[caught?.reason] ?? ERROR_KEYS[FEEDBACK_ERROR.UNKNOWN]))
    } finally {
      setBusy(false)
    }
  }

  if (!isCloudConfigured) {
    return (
      <article className="doc-page">
        <h1>{t('feedback.titleShort')}</h1>
        <p>
          {t('feedback.notConnected')}{' '}
          {PRIVACY_CONTACT ? (
            <>
              {t('feedback.writeContact')} <PrivacyContact />.
            </>
          ) : (
            t('feedback.askTeacher')
          )}
        </p>
      </article>
    )
  }

  if (sent) {
    return (
      <article className="doc-page">
        <h1>{t('feedback.thanks')}</h1>
        <p role="status">
          {t('feedback.sent')} {contact.trim() ? t('feedback.willReply') : t('feedback.noReply')}
        </p>
        <div className="feedback__actions">
          <Button to={fromPath ?? '/'} variant="secondary">
            {t('feedback.back')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSent(false)
              setMessage('')
            }}
          >
            {t('feedback.again')}
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className="doc-page">
      <h1>{t('feedback.title')}</h1>
      <p className="doc-page__lede">{t('feedback.lede')}</p>

      <form className="feedback" onSubmit={submit}>
        <fieldset className="feedback__kinds">
          <legend>{t('feedback.kind')}</legend>
          {Object.keys(FEEDBACK_KINDS).map((value) => (
            <label key={value} className="feedback__kind">
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              <span>{t(`feedback.kind.${value}`)}</span>
            </label>
          ))}
        </fieldset>

        <label className="feedback__label" htmlFor="feedback-message">
          {t('feedback.message')}
        </label>
        <textarea
          id="feedback-message"
          className="feedback__input feedback__message"
          rows={6}
          maxLength={FEEDBACK_MAX}
          required
          value={message}
          aria-describedby="feedback-message-hint"
          onChange={(event) => setMessage(event.target.value)}
        />
        <p id="feedback-message-hint" className="feedback__hint">
          {kind === 'problem' || kind === 'accessibility' ? `${t('feedback.problemHint')} ` : ''}
          {t('feedback.privacyHint')} {message.length} / {FEEDBACK_MAX}
        </p>

        <label className="feedback__label" htmlFor="feedback-contact">
          {t('feedback.contact')}
        </label>
        <input
          id="feedback-contact"
          className="feedback__input"
          maxLength={CONTACT_MAX}
          autoComplete="email"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
        />

        {error && (
          <p className="feedback__error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || message.trim() === ''}>
          {busy ? t('feedback.sending') : t('feedback.send')}
        </Button>

        <p className="feedback__hint">
          {t('feedback.stored')} <Link to="/privacy">{t('feedback.storedLink')}</Link>.
        </p>
      </form>
    </article>
  )
}

export default Feedback
