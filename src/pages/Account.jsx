import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { clearAllResults } from '../games/engine/storage'
import Button from '../components/ui/Button'
import RoleBadge from '../components/ui/RoleBadge'
import AccountSettings from '../components/account/AccountSettings'
import AvatarPicker from '../components/student/AvatarPicker'
import { getSessionIdentity } from '../lib/groups'
import { setMyAvatar } from '../lib/avatar'
import './Account.css'

/*
 * «Моя тваринка» для дитини, що зайшла за кодом. Без міграції 20261015
 * (колонки avatar ще немає) розділу немає зовсім.
 */
function ChildAvatar() {
  const [state, setState] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSessionIdentity()
      .then((identity) => {
        if (!cancelled && identity?.avatarSupported) setState({ avatar: identity.avatar })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!state) return null

  async function pick(key) {
    const previous = state.avatar
    setState({ avatar: key })
    setSaved(false)
    try {
      await setMyAvatar(key)
      setSaved(true)
    } catch {
      setState({ avatar: previous })
    }
  }

  return (
    <section className="account__section" aria-labelledby="account-avatar">
      <h2 id="account-avatar">Моя тваринка</h2>
      <AvatarPicker value={state.avatar} onPick={pick} />
      {saved && (
        <p className="account__note" role="status">
          Готово! Тепер це твоя тваринка.
        </p>
      )}
    </section>
  )
}

function Account() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  // Після видалення сеансу вже немає, і без цього сторінка мовчки перекинула
  // б на вхід — людина не дізналася б, чи все вдалося.
  const [deleted, setDeleted] = useState(false)

  if (deleted) {
    return (
      <section className="account">
        <h1>Акаунт видалено</h1>
        <p role="status">
          Ваш акаунт і пов’язані з ним дані видалено. Дякуємо, що були з нами.
        </p>
        <Button to="/">На головну</Button>
      </section>
    )
  }

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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  /**
   * Передача комп'ютера наступній дитині. Не те саме, що вихід учителя:
   * анонімний акаунт неможливо відкрити знову, тож разом із сеансом треба
   * прибрати й локальну історію ігор — вона лежить на браузері, а не на
   * дитині, і без цього поїхала б у хмару вже під іншим іменем.
   */
  async function handleHandover() {
    await supabase.auth.signOut()
    clearAllResults()
    navigate('/join')
  }

  const isAnonymous = user.is_anonymous
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'moderator'
  const isModerator = profile?.role === 'moderator'

  return (
    <section className="account">
      <h1>
        Акаунт {profile?.role && <RoleBadge role={profile.role} />}
      </h1>
      {isAnonymous ? (
        <>
          <p>
            Ти зайшов як <strong>{profile?.display_name ?? 'учень'}</strong> за кодом групи.
          </p>
          <p className="account__note">
            Це працює лише в цьому браузері на цьому пристрої — прогрес не перенесеться на
            інший телефон чи комп'ютер. Щоб зберігати прогрес між пристроями, попроси вчителя
            або дорослого зареєструватися поштою.
          </p>
          <p className="account__note">
            Закінчив і за комп'ютер сяде хтось інший? Заверши сеанс — тоді наступна дитина
            почне свій, і ваші результати не змішаються. Твої залишаться у вчителя в групі.
          </p>
        </>
      ) : (
        <p>
          Ти увійшов як <strong>{user.email}</strong>. Прогрес зберігається в хмарі й буде
          доступний з будь-якого пристрою після входу з тією самою поштою.
        </p>
      )}
      <div className="account__actions">
        {isTeacher && (
          <Button to="/groups" variant="secondary">
            Мої групи
          </Button>
        )}
        {isModerator && (
          <Button to="/admin" variant="secondary">
            Адмін-панель
          </Button>
        )}
        {isAnonymous ? (
          <Button onClick={handleHandover} variant="secondary">
            Завершити сеанс і передати комп'ютер
          </Button>
        ) : (
          <Button onClick={handleSignOut} variant="secondary">
            Вийти
          </Button>
        )}
      </div>

      {isAnonymous && <ChildAvatar />}

      {!isAnonymous && (
        <AccountSettings user={user} role={profile?.role} onDeleted={() => setDeleted(true)} />
      )}
    </section>
  )
}

export default Account
