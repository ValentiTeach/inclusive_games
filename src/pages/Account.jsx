import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { clearAllResults } from '../games/engine/storage'
import { discardOutbox, settleOutbox, unsentText } from '../lib/outbox'
import Button from '../components/ui/Button'
import RoleBadge from '../components/ui/RoleBadge'
import './Account.css'

function Account() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [handingOver, setHandingOver] = useState(false)
  /*
   * Сеанс завершується заради передачі комп'ютера, а не виходу. Без цього
   * прапорця сторінка, побачивши, що користувача вже немає, сама відправляла
   * дитину на вхід для вчителя — раніше, ніж встигав спрацювати перехід на
   * /join.
   */
  const [leavingForJoin, setLeavingForJoin] = useState(false)
  // Скільки ігор не вдалося надіслати перед передачею; 0 — питати нема про що.
  const [unsent, setUnsent] = useState(0)

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
    return leavingForJoin ? null : <Navigate to="/login" replace />
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  /**
   * Передача комп'ютера наступній дитині. Не те саме, що вихід учителя:
   * анонімний акаунт неможливо відкрити знову, тож разом із сеансом треба
   * прибрати й локальну історію ігор — вона лежить на браузері, а не на
   * дитині, і без цього поїхала б у хмару вже під іншим іменем.
   *
   * З тієї самої причини черга на відправку тут — остання нагода. Після
   * виходу її вже ніхто не відправить: RLS пустить спроби лише від їхнього
   * власника, а власника більше не буде. Тому спершу надсилаємо, і якщо
   * щось лишилось, чесно кажемо про це, а не губимо мовчки.
   */
  async function handleHandover({ force = false } = {}) {
    if (!force) {
      setHandingOver(true)
      const left = await settleOutbox(user.id)
      setHandingOver(false)
      if (left > 0) {
        setUnsent(left)
        return
      }
    }

    const userId = user.id
    setLeavingForJoin(true)
    await supabase.auth.signOut()
    discardOutbox(userId)
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
      {isAnonymous && unsent > 0 && (
        <div className="account__unsent" role="alert">
          <p>
            <strong>{unsentText(unsent)}.</strong> Немає зв’язку з інтернетом, тому вчитель їх
            ще не бачить. Якщо завершити сеанс зараз, ці ігри пропадуть.
          </p>
          <p>Підключися до інтернету й спробуй ще раз.</p>
          <div className="account__actions">
            <Button onClick={() => handleHandover()} disabled={handingOver}>
              {handingOver ? 'Надсилаємо…' : 'Спробувати надіслати ще раз'}
            </Button>
            <Button onClick={() => handleHandover({ force: true })} variant="secondary">
              Все одно завершити
            </Button>
          </div>
        </div>
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
          unsent === 0 && (
            <Button onClick={() => handleHandover()} variant="secondary" disabled={handingOver}>
              {handingOver ? 'Надсилаємо ігри вчителю…' : "Завершити сеанс і передати комп'ютер"}
            </Button>
          )
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
