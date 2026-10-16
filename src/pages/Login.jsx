import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Backpack, GraduationCap, HeartHandshake } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { joinGroup } from '../lib/groups'
import { useT } from '../i18n/i18n'
import './Login.css'

function Login() {
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [mode, setMode] = useState('choose')
  // Батьки входять тією самою поштою, що й учителі, — але після входу їм
  // потрібна сторінка «Моя дитина», а не групи.
  const [forParent, setForParent] = useState(false)

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
    return <div className="login login--plain">{t('login.loading')}</div>
  }

  if (user) {
    return <Navigate to="/account" replace />
  }

  if (!isCloudConfigured) {
    return (
      <section className="login login--plain">
        <h1>{t('login.title')}</h1>
        <p>{t('login.notConnected')}</p>
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
      setJoinError(t('login.joinError'))
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
        emailRedirectTo: forParent ? `${window.location.origin}/child` : window.location.origin,
        shouldCreateUser: isRegister,
        ...(isRegister && teacherName.trim() ? { data: { display_name: teacherName.trim() } } : {}),
      },
    })

    if (error) {
      setEmailStatus('idle')

      if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
        setEmailError(t('login.rateLimited'))
      } else if (!isRegister && (error.status === 400 || error.status === 422)) {
        setEmailError(t('login.notFound'))
      } else {
        setEmailError(
          t(isRegister ? 'login.registerFailed' : 'login.loginFailed', {
            message: error.message || t('login.unknownError'),
          }),
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
        <h1 className="login__title">{t('login.heroTitle')}</h1>
        <p className="login__subtitle">{t('login.heroSubtitle')}</p>
      </div>

      {mode === 'choose' && (
        <div className="login__cards">
          <button type="button" className="login__card" onClick={() => setMode('student')}>
            <Backpack className="login__card-icon" aria-hidden="true" />
            <span className="login__card-title">{t('login.student.title')}</span>
            <span className="login__card-text">{t('login.student.text')}</span>
          </button>
          <button
            type="button"
            className="login__card"
            onClick={() => {
              setForParent(false)
              setMode('teacher')
            }}
          >
            <GraduationCap className="login__card-icon" aria-hidden="true" />
            <span className="login__card-title">{t('login.teacher.title')}</span>
            <span className="login__card-text">{t('login.teacher.text')}</span>
          </button>
          <button
            type="button"
            className="login__card"
            onClick={() => {
              setForParent(true)
              setMode('teacher')
            }}
          >
            <HeartHandshake className="login__card-icon" aria-hidden="true" />
            <span className="login__card-title">{t('login.parent.title')}</span>
            <span className="login__card-text">{t('login.parent.text')}</span>
          </button>
        </div>
      )}

      {mode === 'student' && (
        <div className="login__panel">
          <button type="button" className="login__back" onClick={() => setMode('choose')}>
            {t('login.back')}
          </button>
          <h2 className="login__panel-title">{t('login.joinTitle')}</h2>
          <form className="login__form" onSubmit={handleJoin}>
            <label className="login__label" htmlFor="login-code">
              {t('login.code')}
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
              {t('login.name')}
            </label>
            <input
              id="login-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="login__input"
              placeholder={t('login.namePlaceholder')}
            />
            {joinError && <p className="login__error">{joinError}</p>}
            <button type="submit" className="login__submit" disabled={joinStatus === 'sending'}>
              {joinStatus === 'sending' ? t('login.joining') : t('login.join')}
            </button>
          </form>
        </div>
      )}

      {mode === 'teacher' && (
        <div className="login__panel">
          <button type="button" className="login__back" onClick={() => setMode('choose')}>
            {t('login.back')}
          </button>
          <h2 className="login__panel-title">
            {forParent
              ? t('login.parent.title')
              : teacherMode === 'register'
                ? t('login.register')
                : t('login.emailLogin')}
          </h2>
          {forParent && <p className="login__hint">{t('login.parent.hint')}</p>}

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
                {t('login.tabLogin')}
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
                {t('login.register')}
              </button>
            </div>
          )}

          {emailStatus !== 'sent' && teacherMode === 'register' && (
            <p className="login__hint">{t('login.registerHint')}</p>
          )}

          {emailStatus === 'sent' ? (
            <p className="login__sent">
              {t(teacherMode === 'register' ? 'login.sentRegister' : 'login.sentLogin', { email })}
            </p>
          ) : (
            <form className="login__form" onSubmit={handleEmail}>
              {teacherMode === 'register' && (
                <>
                  <label className="login__label" htmlFor="login-teacher-name">
                    {t('login.adultName')}
                  </label>
                  <input
                    id="login-teacher-name"
                    type="text"
                    required
                    value={teacherName}
                    onChange={(event) => setTeacherName(event.target.value)}
                    className="login__input"
                    placeholder={t('login.namePlaceholder')}
                  />
                </>
              )}
              <label className="login__label" htmlFor="login-email">
                {t('login.email')}
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
                  ? t('login.sending')
                  : teacherMode === 'register'
                    ? t('login.registerSubmit')
                    : t('login.loginSubmit')}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}

export default Login
