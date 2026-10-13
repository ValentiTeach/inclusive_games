import { useEffect, useState } from 'react'
import { Mail, LogOut, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import {
  ACCOUNT_ERROR,
  ACCOUNT_ERROR_TEXT,
  changeEmail,
  deleteMyAccount,
  fetchOwnGroups,
  forgetSession,
  signOutEverywhere,
  transferMyGroups,
} from '../../lib/account'

const CONFIRM_WORD = 'ВИДАЛИТИ'

function errorText(caught) {
  return ACCOUNT_ERROR_TEXT[caught?.reason] ?? ACCOUNT_ERROR_TEXT[ACCOUNT_ERROR.UNKNOWN]
}

function EmailSection({ currentEmail }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await changeEmail(email)
      setSentTo(email.trim())
      setEmail('')
    } catch {
      setError('Не вдалося змінити пошту. Перевірте адресу й спробуйте ще раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="account__section" aria-labelledby="account-email">
      <h2 id="account-email">
        <Mail size={18} aria-hidden="true" /> Пошта
      </h2>
      {sentTo ? (
        <p className="account__sent" role="status">
          Лист підтвердження надіслано на <strong>{sentTo}</strong>. Пошта зміниться, щойно ви
          перейдете за посиланням у листі. До того вхід — зі старою адресою.
        </p>
      ) : (
        <form className="account__form" onSubmit={submit}>
          <label className="account__label" htmlFor="account-new-email">
            Нова пошта
          </label>
          <input
            id="account-new-email"
            className="account__input"
            type="email"
            autoComplete="email"
            required
            value={email}
            placeholder={currentEmail ?? 'name@school.ua'}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error && <p className="account__error">{error}</p>}
          <Button type="submit" variant="secondary" disabled={busy || email.trim() === ''}>
            {busy ? 'Надсилаю…' : 'Змінити пошту'}
          </Button>
        </form>
      )}
    </section>
  )
}

function SessionsSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function signOutAll() {
    const confirmed = window.confirm(
      'Вийти з акаунта на всіх пристроях, зокрема на цьому? Увійти знову можна буде поштою.',
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      await signOutEverywhere()
    } catch {
      setError('Не вдалося вийти на всіх пристроях. Спробуйте ще раз.')
      setBusy(false)
    }
  }

  return (
    <section className="account__section" aria-labelledby="account-sessions">
      <h2 id="account-sessions">
        <LogOut size={18} aria-hidden="true" /> Пристрої
      </h2>
      <p className="account__note">
        Загубили телефон або входили на чужому комп’ютері? Ця кнопка завершує всі сеанси
        акаунта. На іншому пристрої сторінка може працювати ще до години, але оновити вхід там
        уже не вийде.
      </p>
      {error && <p className="account__error">{error}</p>}
      <Button variant="secondary" onClick={signOutAll} disabled={busy}>
        Вийти на всіх пристроях
      </Button>
    </section>
  )
}

function DeleteSection({ userId, role, onDeleted }) {
  const [groups, setGroups] = useState(null)
  const [colleague, setColleague] = useState('')
  const [deleteGroups, setDeleteGroups] = useState(false)
  const [confirmWord, setConfirmWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const isModerator = role === 'moderator'

  useEffect(() => {
    if (isModerator) return undefined
    let cancelled = false
    fetchOwnGroups(userId)
      .then((rows) => {
        if (!cancelled) setGroups(rows)
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, isModerator])

  if (isModerator) {
    return (
      <section className="account__section account__danger" aria-labelledby="account-delete">
        <h2 id="account-delete">
          <Trash2 size={18} aria-hidden="true" /> Видалити акаунт
        </h2>
        <p className="account__note">{ACCOUNT_ERROR_TEXT[ACCOUNT_ERROR.MODERATOR_ACCOUNT]}</p>
      </section>
    )
  }

  async function transfer(event) {
    event.preventDefault()
    const confirmed = window.confirm(
      `Передати всі ваші групи (${groups.length}) вчителю ${colleague.trim()}? Він побачить дітей, їхні результати й заняття. Ваш щоденник фахівця не передається — він зашифрований вашим ключем.`,
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      const count = await transferMyGroups(colleague)
      setMessage(`Передано груп: ${count}.`)
      setColleague('')
      setGroups([])
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await deleteMyAccount({ deleteGroups: hasGroups && deleteGroups })
      onDeleted()
      await forgetSession()
    } catch (caught) {
      setError(errorText(caught))
      setBusy(false)
    }
  }

  const hasGroups = (groups?.length ?? 0) > 0
  const ready = confirmWord.trim().toUpperCase() === CONFIRM_WORD && (!hasGroups || deleteGroups)

  return (
    <section className="account__section account__danger" aria-labelledby="account-delete">
      <h2 id="account-delete">
        <Trash2 size={18} aria-hidden="true" /> Видалити акаунт
      </h2>
      <p className="account__note">
        Акаунт і все, що належить лише вам, — щоденник фахівця, власні шаблони занять, заявки й
        доступ до дітей як батьків — видаляються назавжди. Скасувати це неможливо.
      </p>

      {message && (
        <p className="account__sent" role="status">
          {message}
        </p>
      )}

      {hasGroups && (
        <div className="account__groups">
          <p>
            У вас {groups.length === 1 ? 'є група' : `є групи (${groups.length})`}:{' '}
            <strong>{groups.map((group) => group.name).join(', ')}</strong>. Що з ними зробити?
          </p>

          <form className="account__form" onSubmit={transfer}>
            <label className="account__label" htmlFor="account-colleague">
              Передати колезі — пошта вчителя
            </label>
            <input
              id="account-colleague"
              className="account__input"
              type="email"
              autoComplete="off"
              value={colleague}
              placeholder="kolega@school.ua"
              onChange={(event) => setColleague(event.target.value)}
            />
            <p className="account__note">
              Колега має бути вже зареєстрований на сайті. Діти, їхні результати, завдання, заняття
              й цілі ІПР перейдуть до нього; ваш щоденник — ні.
            </p>
            <Button type="submit" variant="secondary" disabled={busy || colleague.trim() === ''}>
              Передати групи
            </Button>
          </form>

          <label className="account__check">
            <input
              type="checkbox"
              checked={deleteGroups}
              onChange={(event) => setDeleteGroups(event.target.checked)}
            />
            <span>
              Або видалити групи разом з акаунтом — і <strong>назавжди</strong> всіх дітей у них
              з їхніми результатами.
            </span>
          </label>
        </div>
      )}

      <form className="account__form" onSubmit={remove}>
        <label className="account__label" htmlFor="account-confirm">
          Щоб підтвердити, введіть {CONFIRM_WORD}
        </label>
        <input
          id="account-confirm"
          className="account__input"
          autoComplete="off"
          spellCheck={false}
          value={confirmWord}
          onChange={(event) => setConfirmWord(event.target.value)}
        />
        {error && <p className="account__error">{error}</p>}
        <Button type="submit" variant="danger" disabled={busy || groups === null || !ready}>
          {busy ? 'Видаляю…' : 'Видалити акаунт назавжди'}
        </Button>
      </form>
    </section>
  )
}

/**
 * Налаштування акаунта дорослого (вхід поштою). Учень за кодом групи цього
 * не бачить: його дані — під згодою батьків, і керує ними вчитель.
 */
function AccountSettings({ user, role, onDeleted }) {
  return (
    <>
      <EmailSection currentEmail={user.email} />
      <SessionsSection />
      <DeleteSection userId={user.id} role={role} onDeleted={onDeleted} />
    </>
  )
}

export default AccountSettings
