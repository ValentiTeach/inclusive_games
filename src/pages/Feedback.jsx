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
import './DocPage.css'
import './Feedback.css'

const ERROR_TEXT = {
  [FEEDBACK_ERROR.EMPTY]: 'Напишіть хоч кілька слів.',
  [FEEDBACK_ERROR.TOO_MANY]:
    'Ви вже надіслали кілька повідомлень за годину. Спробуйте трохи пізніше — ми все отримали.',
  [FEEDBACK_ERROR.UNAVAILABLE]: 'Форма ще не ввімкнена на сервері. Спробуйте пізніше.',
  [FEEDBACK_ERROR.UNKNOWN]: 'Не вдалося надіслати. Перевірте зв’язок і спробуйте ще раз.',
}

/**
 * «Повідомити про проблему / ідею».
 *
 * Досі вчителька могла лише зателефонувати через тиждень і сказати «щось не
 * працює». Форма запам'ятовує сторінку, з якої людина прийшла (Footer передає
 * її в state), і версію сайту — це половина відповіді на «що саме».
 */
function Feedback() {
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
      setError(ERROR_TEXT[caught?.reason] ?? ERROR_TEXT[FEEDBACK_ERROR.UNKNOWN])
    } finally {
      setBusy(false)
    }
  }

  if (!isCloudConfigured) {
    return (
      <article className="doc-page">
        <h1>Повідомити про проблему</h1>
        <p>
          Форма зворотного зв’язку на цьому сайті не підключена.{' '}
          {PRIVACY_CONTACT ? (
            <>
              Напишіть відповідальному за платформу: <PrivacyContact />.
            </>
          ) : (
            'Розкажіть про проблему вчителю чи фахівцю, який дав вам посилання.'
          )}
        </p>
      </article>
    )
  }

  if (sent) {
    return (
      <article className="doc-page">
        <h1>Дякуємо!</h1>
        <p role="status">
          Повідомлення надіслано.{' '}
          {contact.trim()
            ? 'Ми відповімо на вказаний контакт, щойно розберемося.'
            : 'Ви не лишили контакту, тож відповіді не буде, — але ми прочитаємо кожне слово.'}
        </p>
        <div className="feedback__actions">
          <Button to={fromPath ?? '/'} variant="secondary">
            Повернутися
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSent(false)
              setMessage('')
            }}
          >
            Написати ще
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className="doc-page">
      <h1>Повідомити про проблему чи ідею</h1>
      <p className="doc-page__lede">
        Щось не працює, незручно або бракує гри? Напишіть — повідомлення читає модератор
        платформи.
      </p>

      <form className="feedback" onSubmit={submit}>
        <fieldset className="feedback__kinds">
          <legend>Про що</legend>
          {Object.entries(FEEDBACK_KINDS).map(([value, label]) => (
            <label key={value} className="feedback__kind">
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <label className="feedback__label" htmlFor="feedback-message">
          Що сталося або що пропонуєте
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
          {kind === 'problem' || kind === 'accessibility'
            ? 'Яка сторінка чи гра, з якого пристрою, що ви натиснули і що побачили. '
            : ''}
          Будь ласка, не пишіть прізвищ, адрес чи телефонів дітей. {message.length} / {FEEDBACK_MAX}
        </p>

        <label className="feedback__label" htmlFor="feedback-contact">
          Пошта чи телефон для відповіді (необов’язково)
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
          {busy ? 'Надсилаю…' : 'Надіслати'}
        </Button>

        <p className="feedback__hint">
          Разом із повідомленням зберігаються адреса сторінки, з якої ви прийшли, назва браузера
          і версія сайту — щоб відтворити проблему. Повідомлення видаляються через 12 місяців.
          Детальніше — у <Link to="/privacy">«Дані та приватність»</Link>.
        </p>
      </form>
    </article>
  )
}

export default Feedback
