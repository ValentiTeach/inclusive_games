import { useEffect, useState } from 'react'
import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import {
  MIN_PASSPHRASE,
  WrongPassphraseError,
  changePassphrase,
  createVault,
  fetchMyVault,
  isCryptoSupported,
  lockVault,
  unlockMyVault,
  useVaultState,
} from '../../lib/vault'
import './Specialist.css'

/**
 * Захищений щоденник: створити, відімкнути, замкнути, змінити пароль.
 *
 * Пароль не йде на сервер і не відновлюється — це сказано прямо перед тим, як
 * його задати, а не дрібним шрифтом після: учитель, який забуде пароль,
 * втратить записи, і він має знати це, доки ще вибирає пароль.
 *
 * `onReady(record)` — сховище є (замкнене чи ні): батьківська сторінка вже
 * може шифрувати нові записи відкритим ключем.
 */
function VaultPanel({ onReady, compact = false }) {
  const vault = useVaultState()
  const [record, setRecord] = useState(undefined)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [next, setNext] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMyVault()
      .then((data) => {
        if (cancelled) return
        setRecord(data)
        if (data) onReady?.(data)
      })
      .catch(() => !cancelled && setRecord(undefined))
    return () => {
      cancelled = true
    }
    // onReady — колбек батька; перезапитувати сховище через нього не треба.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isCryptoSupported()) {
    return (
      <p className="vault__note">Цей браузер не вміє шифрувати, тож щоденник тут недоступний.</p>
    )
  }

  if (record === undefined) return null

  async function handleCreate(event) {
    event.preventDefault()
    setMessage(null)
    if (passphrase.length < MIN_PASSPHRASE) {
      setMessage(`Пароль має бути щонайменше ${MIN_PASSPHRASE} символів.`)
      return
    }
    if (passphrase !== confirm) {
      setMessage('Паролі не збігаються.')
      return
    }
    setBusy(true)
    try {
      const created = await createVault(passphrase)
      setRecord(created)
      setPassphrase('')
      setConfirm('')
      onReady?.(created)
    } catch {
      setMessage('Не вдалося створити щоденник. Спробуй ще раз.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock(event) {
    event.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      await unlockMyVault(record, passphrase)
      setPassphrase('')
    } catch (error) {
      setMessage(
        error instanceof WrongPassphraseError ? 'Пароль не підходить.' : 'Не вдалося відімкнути.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleChange(event) {
    event.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      const updated = await changePassphrase(record, passphrase, next)
      setRecord(updated)
      setPassphrase('')
      setNext('')
      setChanging(false)
      setMessage('Пароль змінено. Старі записи читаються новим паролем.')
    } catch (error) {
      setMessage(
        error instanceof WrongPassphraseError
          ? 'Поточний пароль не підходить.'
          : error.message === 'passphrase_too_short'
            ? `Новий пароль має бути щонайменше ${MIN_PASSPHRASE} символів.`
            : 'Не вдалося змінити пароль.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (record === null) {
    return (
      <form className="vault" onSubmit={handleCreate}>
        <h3 className="vault__title">
          <ShieldCheck size={18} aria-hidden="true" /> Захищений щоденник
        </h3>
        <p className="vault__note">
          Нотатки щоденника й настрій дітей шифруються просто в браузері — сервер бачить лише шифр.
          Задай пароль щоденника (не пароль від пошти). <strong>Відновити його неможливо:</strong>{' '}
          забутий пароль — це втрачені записи. Запиши його в надійне місце.
        </p>
        <label className="vault__field">
          <span>Пароль щоденника</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </label>
        <label className="vault__field">
          <span>Ще раз</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        <button type="submit" className="vault__button" disabled={busy}>
          {busy ? 'Створюємо ключ…' : 'Створити щоденник'}
        </button>
        {message && (
          <p className="vault__error" role="alert">
            {message}
          </p>
        )}
      </form>
    )
  }

  if (vault.privateKey) {
    return (
      <div className="vault vault--open">
        <p className="vault__status">
          <LockOpen size={16} aria-hidden="true" /> Щоденник відімкнено в цій вкладці. Сам
          замкнеться за пів години без діла.
        </p>
        <div className="vault__row">
          <button
            type="button"
            className="vault__button vault__button--secondary"
            onClick={lockVault}
          >
            Замкнути
          </button>
          {!compact && (
            <button
              type="button"
              className="vault__button vault__button--secondary"
              onClick={() => setChanging((value) => !value)}
            >
              Змінити пароль
            </button>
          )}
        </div>
        {changing && (
          <form className="vault__change" onSubmit={handleChange}>
            <label className="vault__field">
              <span>Поточний пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>
            <label className="vault__field">
              <span>Новий пароль</span>
              <input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </label>
            <button type="submit" className="vault__button" disabled={busy}>
              Зберегти новий пароль
            </button>
          </form>
        )}
        {message && (
          <p className="vault__note" role="status">
            {message}
          </p>
        )}
      </div>
    )
  }

  return (
    <form className="vault" onSubmit={handleUnlock}>
      <p className="vault__status">
        <Lock size={16} aria-hidden="true" /> Щоденник замкнено. Нові записи можна додавати й так, а
        щоб прочитати — введи пароль щоденника.
      </p>
      <div className="vault__row">
        <label className="vault__field vault__field--inline">
          <span className="visually-hidden">Пароль щоденника</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Пароль щоденника"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </label>
        <button type="submit" className="vault__button" disabled={busy || !passphrase}>
          {busy ? 'Перевіряємо…' : 'Відімкнути'}
        </button>
      </div>
      {message && (
        <p className="vault__error" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

export default VaultPanel
