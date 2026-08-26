import { useState } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import Button from '../components/ui/Button'
import './Account.css'

function Account() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  if (!isCloudConfigured) {
    return (
      <section className="account">
        <h1>Акаунт</h1>
        <p>Синхронізацію між пристроями ще не підключено на цьому сайті.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="account">
        <h1>Акаунт</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setStatus('idle')
      setErrorMessage(`Не вдалося надіслати посилання: ${error.message} (код: ${error.status ?? '?'})`)
      return
    }

    setStatus('sent')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (user) {
    return (
      <section className="account">
        <h1>Акаунт</h1>
        <p>
          Ти увійшов як <strong>{user.email}</strong>. Прогрес зберігається в хмарі й буде
          доступний з будь-якого пристрою після входу з тією самою поштою.
        </p>
        <Button onClick={handleSignOut} variant="secondary">
          Вийти
        </Button>
      </section>
    )
  }

  return (
    <section className="account">
      <h1>Акаунт</h1>
      <p>
        Увійди поштою, щоб прогрес зберігався в хмарі й був доступний з будь-якого пристрою.
        Пароль не потрібен — надішлемо посилання для входу.
      </p>

      {status === 'sent' ? (
        <p className="account__sent">
          Перевір пошту <strong>{email}</strong> і перейди за посиланням, щоб увійти.
        </p>
      ) : (
        <form className="account__form" onSubmit={handleSubmit}>
          <label className="account__label" htmlFor="email">
            Електронна пошта
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="account__input"
            placeholder="you@example.com"
          />
          {errorMessage && <p className="account__error">{errorMessage}</p>}
          <Button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Надсилаємо…' : 'Надіслати посилання для входу'}
          </Button>
        </form>
      )}
    </section>
  )
}

export default Account
