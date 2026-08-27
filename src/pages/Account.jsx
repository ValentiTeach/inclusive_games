import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import Button from '../components/ui/Button'
import RoleBadge from '../components/ui/RoleBadge'
import './Account.css'

function Account() {
  const { user, profile, loading } = useAuth()

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
        <Button onClick={handleSignOut} variant="secondary">
          Вийти
        </Button>
      </div>
    </section>
  )
}

export default Account
