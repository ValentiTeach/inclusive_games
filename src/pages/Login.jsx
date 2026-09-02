import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Backpack, GraduationCap } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { joinGroup } from '../lib/groups'
import './Login.css'

function Login() {
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('choose')

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [joinStatus, setJoinStatus] = useState('idle')
  const [joinError, setJoinError] = useState(null)

  const [teacherMode, setTeacherMode] = useState('login')
  const [email, setEmail] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [emailStatus, setEmailStatus] = useState('idle')
  const [emailError, setEmailError] = useState(null)

  if (loading) {
    return <div className="login login--plain">Завантаження…</div>
  }

  if (user) {
    return <Navigate to="/account" replace />
  }

  if (!isCloudConfigured) {
    return (
      <section className="login login--plain">
        <h1>Вхід</h1>
        <p>Вхід ще не підключено на цьому сайті.</p>
      </section>
    )
  }

  async function handleJoin(event) {
    event.preventDefault()
    setJoinStatus('sending')
    setJoinError(null)

    try {
      await joinGroup(code, name)
      const {
        data: { user: signedInUser },
      } = await supabase.auth.getUser()
      await refreshProfile(signedInUser)
      navigate('/games')
    } catch {
      setJoinStatus('idle')
      setJoinError('Не вдалося приєднатися. Перевір код і спробуй ще раз.')
    }
  }

  async function handleEmail(event) {
    event.preventDefault()
    setEmailStatus('sending')
    setEmailError(null)

    const isRegister = teacherMode === 'register'

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: isRegister,
        ...(isRegister && teacherName.trim() ? { data: { display_name: teacherName.trim() } } : {}),
      },
    })

    if (error) {
      setEmailStatus('idle')

      if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
        setEmailError('Забагато спроб за короткий час. Зачекай кілька хвилин і спробуй ще раз.')
      } else if (!isRegister && (error.status === 400 || error.status === 422)) {
        setEmailError('Акаунт із такою поштою не знайдено. Якщо в тебе ще немає акаунта — перейди на «Реєстрація».')
      } else {
        setEmailError(
          `${isRegister ? 'Не вдалося зареєструватися' : 'Не вдалося увійти'}: ${error.message || 'невідома помилка'}`,
        )
      }
      return
    }

    setEmailStatus('sent')
  }

  return (
    <section className="login">
      <div className="login__hero">
        <p className="login__eyebrow">Inclusive Games</p>
        <h1 className="login__title">Вхід у платформу</h1>
        <p className="login__subtitle">
          Обери, як ти заходиш — це визначить, що ти побачиш далі.
        </p>
      </div>

      {mode === 'choose' && (
        <div className="login__cards">
          <button type="button" className="login__card" onClick={() => setMode('student')}>
            <Backpack className="login__card-icon" aria-hidden="true" />
            <span className="login__card-title">Я учень</span>
            <span className="login__card-text">Код групи від вчителя + твоє ім'я. Пошта не потрібна.</span>
          </button>
          <button type="button" className="login__card" onClick={() => setMode('teacher')}>
            <GraduationCap className="login__card-icon" aria-hidden="true" />
            <span className="login__card-title">Я вчитель / психолог</span>
            <span className="login__card-text">Вхід або реєстрація поштою — без пароля, посиланням.</span>
          </button>
        </div>
      )}

      {mode === 'student' && (
        <div className="login__panel">
          <button type="button" className="login__back" onClick={() => setMode('choose')}>
            ← Назад
          </button>
          <h2 className="login__panel-title">Приєднатися за кодом</h2>
          <form className="login__form" onSubmit={handleJoin}>
            <label className="login__label" htmlFor="login-code">
              Код групи
            </label>
            <input
              id="login-code"
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="login__input login__input--code"
              placeholder="ABC123"
              autoComplete="off"
            />
            <label className="login__label" htmlFor="login-name">
              Твоє ім'я
            </label>
            <input
              id="login-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="login__input"
              placeholder="Ім'я"
            />
            {joinError && <p className="login__error">{joinError}</p>}
            <button type="submit" className="login__submit" disabled={joinStatus === 'sending'}>
              {joinStatus === 'sending' ? 'Приєднуємо…' : 'Приєднатися'}
            </button>
          </form>
        </div>
      )}

      {mode === 'teacher' && (
        <div className="login__panel">
          <button type="button" className="login__back" onClick={() => setMode('choose')}>
            ← Назад
          </button>
          <h2 className="login__panel-title">
            {teacherMode === 'register' ? 'Реєстрація' : 'Вхід поштою'}
          </h2>

          {emailStatus !== 'sent' && (
            <div className="login__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={teacherMode === 'login'}
                className={`login__tab${teacherMode === 'login' ? ' login__tab--active' : ''}`}
                onClick={() => {
                  setTeacherMode('login')
                  setEmailError(null)
                }}
              >
                Вхід
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={teacherMode === 'register'}
                className={`login__tab${teacherMode === 'register' ? ' login__tab--active' : ''}`}
                onClick={() => {
                  setTeacherMode('register')
                  setEmailError(null)
                }}
              >
                Реєстрація
              </button>
            </div>
          )}

          {emailStatus !== 'sent' && teacherMode === 'register' && (
            <p className="login__hint">Створи акаунт вчителя/психолога — посилання для входу прийде на пошту.</p>
          )}

          {emailStatus === 'sent' ? (
            <p className="login__sent">
              Перевір пошту <strong>{email}</strong> і перейди за посиланням, щоб{' '}
              {teacherMode === 'register' ? 'завершити реєстрацію' : 'увійти'}.
            </p>
          ) : (
            <form className="login__form" onSubmit={handleEmail}>
              {teacherMode === 'register' && (
                <>
                  <label className="login__label" htmlFor="login-teacher-name">
                    Ім'я
                  </label>
                  <input
                    id="login-teacher-name"
                    type="text"
                    required
                    value={teacherName}
                    onChange={(event) => setTeacherName(event.target.value)}
                    className="login__input"
                    placeholder="Ім'я"
                  />
                </>
              )}
              <label className="login__label" htmlFor="login-email">
                Електронна пошта
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="login__input"
                placeholder="you@example.com"
              />
              {emailError && <p className="login__error">{emailError}</p>}
              <button type="submit" className="login__submit" disabled={emailStatus === 'sending'}>
                {emailStatus === 'sending'
                  ? 'Надсилаємо…'
                  : teacherMode === 'register'
                    ? 'Зареєструватися'
                    : 'Надіслати посилання для входу'}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}

export default Login
