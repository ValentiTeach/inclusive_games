import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { JOIN_ERROR, getSessionIdentity, joinGroup } from '../lib/groups'
import Button from '../components/ui/Button'
import './Join.css'

// The server speaks in tokens; the child reads Ukrainian. Everything the RPC
// can refuse has its own sentence, because "не вдалося приєднатися" for six
// different causes is what sends a teacher hunting through a dashboard.
const ERROR_TEXT = {
  [JOIN_ERROR.INVALID_CODE]: 'Такої групи немає. Перевір код — його дає вчитель.',
  [JOIN_ERROR.EMPTY_NAME]: 'Напиши своє ім’я.',
  [JOIN_ERROR.NAME_TOO_LONG]: 'Ім’я задовге — не більше 60 символів.',
  [JOIN_ERROR.NOT_A_STUDENT]:
    'Це вчительський акаунт. Приєднатися до групи за кодом можна лише учнівським входом.',
  [JOIN_ERROR.SESSION_BELONGS_TO_OTHER]:
    'Цей сеанс належить іншій дитині. Натисни «Це не я», щоб почати свій — її результати залишаться в неї.',
  [JOIN_ERROR.NOT_SIGNED_IN]: 'Сеанс перервався. Спробуй ще раз.',
  [JOIN_ERROR.UNKNOWN]: 'Не вдалося приєднатися. Спробуй ще раз.',
}

function Join() {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()

  // undefined = ще перевіряємо, null = на пристрої нікого
  const [identity, setIdentity] = useState(undefined)
  const [handover, setHandover] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    if (!isCloudConfigured) return

    let cancelled = false
    getSessionIdentity()
      .then((found) => {
        if (!cancelled) setIdentity(found)
      })
      .catch(() => {
        // Не знаємо, хто на пристрої — питаємо ім'я, як у чистого браузера.
        if (!cancelled) setIdentity(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isCloudConfigured) {
    return (
      <section className="join">
        <h1>Приєднатися до групи</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (identity === undefined) {
    return (
      <section className="join">
        <h1>Приєднатися до групи</h1>
        <p>Перевіряємо, хто зараз на цьому пристрої…</p>
      </section>
    )
  }

  // Пошта — це вхід для вчителя. Якщо не зупинити тут, сервер усе одно
  // відмовить (not_a_student), але дитина побачить незрозумілу помилку
  // замість пояснення, що комп'ютер просто не звільнили.
  if (identity && !identity.isAnonymous) {
    return (
      <section className="join">
        <h1>Приєднатися до групи</h1>
        <p>
          На цьому пристрої відкритий акаунт{' '}
          <strong>{identity.email ?? identity.displayName ?? 'вчителя'}</strong>. Код групи —
          це вхід для учня, тому спершу треба вийти.
        </p>
        <div className="join__actions">
          <Button
            onClick={async () => {
              await supabase.auth.signOut()
              setIdentity(null)
              setHandover(false)
            }}
          >
            Вийти й приєднатися як учень
          </Button>
          <Button to="/account" variant="secondary">
            Мій акаунт
          </Button>
        </div>
      </section>
    )
  }

  // Анонімний сеанс з іменем — на пристрої вже є дитина.
  const currentStudent = identity?.displayName ?? null
  const asReturningStudent = Boolean(currentStudent) && !handover

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    try {
      await joinGroup(code, asReturningStudent ? currentStudent : name, {
        startFresh: handover,
      })
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await refreshProfile(user)
      navigate('/games')
    } catch (error) {
      setStatus('idle')
      const reason = error?.reason ?? JOIN_ERROR.UNKNOWN
      setErrorMessage(ERROR_TEXT[reason] ?? ERROR_TEXT[JOIN_ERROR.UNKNOWN])
      // Сервер побачив те, чого не бачила сторінка (стара вкладка, вчитель
      // перейменував учня). Відкриваємо поле імені, щоб вихід був за один крок.
      if (reason === JOIN_ERROR.SESSION_BELONGS_TO_OTHER) setHandover(true)
    }
  }

  function startHandover() {
    setHandover(true)
    setErrorMessage(null)
    setName('')
  }

  return (
    <section className="join">
      <h1>Приєднатися до групи</h1>

      {currentStudent && !handover && (
        <div className="join__whoami">
          <p className="join__whoami-line">
            На цьому пристрої зараз <strong>{currentStudent}</strong>.
          </p>
          <p className="join__note">
            Якщо це не ти — почни свій сеанс, і твої результати не змішаються з її.
          </p>
          <button type="button" className="join__linkish" onClick={startHandover}>
            Це не я
          </button>
        </div>
      )}

      {handover && (
        <div className="join__whoami">
          <p className="join__whoami-line">Починаємо новий сеанс.</p>
          <p className="join__note">
            {currentStudent
              ? `Сеанс ${currentStudent} завершиться на цьому пристрої. Її результати нікуди не зникнуть — вони залишаються у вчителя в групі.`
              : 'Попередній сеанс на цьому пристрої завершиться.'}
          </p>
        </div>
      )}

      {!currentStudent && !handover && (
        <p>Введи код, який дав тобі вчитель, і своє ім’я — пошта не потрібна.</p>
      )}

      <form className="join__form" onSubmit={handleSubmit}>
        <label className="join__label" htmlFor="code">
          Код групи
        </label>
        <input
          id="code"
          type="text"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="join__input join__input--code"
          placeholder="ABC123"
          maxLength={6}
        />

        {!asReturningStudent && (
          <>
            <label className="join__label" htmlFor="name">
              Твоє ім’я
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="join__input"
              placeholder="Ім’я"
              maxLength={60}
            />
          </>
        )}

        {errorMessage && <p className="join__error">{errorMessage}</p>}

        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending'
            ? 'Приєднуємось…'
            : asReturningStudent
              ? `Продовжити як ${currentStudent}`
              : 'Приєднатися'}
        </Button>
      </form>
    </section>
  )
}

export default Join
