import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { clearAllResults } from '../games/engine/storage'
import Button from '../components/ui/Button'
import RoleBadge from '../components/ui/RoleBadge'
import './Account.css'

function Account() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

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
    </section>
  )
}

export default Account
