import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { isCloudConfigured } from '../lib/supabaseClient'
import { createGroup, getMyGroups } from '../lib/groups'
import Button from '../components/ui/Button'
import './Groups.css'

function Groups() {
  const { user, loading } = useAuth()
  const [groups, setGroups] = useState(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false
    getMyGroups()
      .then((data) => {
        if (!cancelled) setGroups(data)
      })
      .catch(() => {
        if (!cancelled) {
          setGroups([])
          setErrorMessage('Не вдалося завантажити групи. Спробуй оновити сторінку.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!isCloudConfigured) {
    return (
      <section className="groups">
        <h1>Групи</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="groups">
        <h1>Групи</h1>
        <p>Завантаження…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="groups">
        <h1>Групи</h1>
        <p>
          Керувати групами можуть лише зареєстровані вчителі. Спершу увійди поштою на
          сторінці входу.
        </p>
        <Button to="/login" variant="secondary">
          До входу
        </Button>
      </section>
    )
  }

  // Показуємо справжню адресу цього ж сайту, а не приклад: вчитель має
  // продиктувати її класу, і «щось на кшталт» тут не годиться.
  const joinUrl = `${window.location.host}/join`

  async function handleCreate(event) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    try {
      const group = await createGroup(name.trim())
      setGroups((prev) => [group, ...(prev ?? [])])
      setName('')
      setStatus('idle')
    } catch {
      setStatus('idle')
      setErrorMessage('Не вдалося створити групу. Спробуй ще раз.')
    }
  }

  return (
    <section className="groups">
      <h1>Групи</h1>
      <p>
        Створи групу для свого класу — учні приєднаються за кодом на сторінці
        «Приєднатися до групи», без пошти й пароля.
      </p>

      <form className="groups__form" onSubmit={handleCreate}>
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="groups__input"
          placeholder="Назва групи, напр. 5-А клас"
        />
        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Створюємо…' : 'Створити групу'}
        </Button>
      </form>

      {errorMessage && <p className="groups__error">{errorMessage}</p>}

      {groups === null ? (
        <p>Завантаження груп…</p>
      ) : groups.length === 0 ? (
        /* Перший вхід вчителя закінчувався фразою «У тебе ще немає жодної
           групи» — констатацією без жодної підказки, що робити далі. Три кроки
           замість неї: створити, роздати код, і що побачиш потім. */
        <ol className="groups__steps">
          <li>
            <strong>Створи групу</strong> — назви її так, як називаєш клас.
          </li>
          <li>
            <strong>Продиктуй код</strong>, який зʼявиться поруч із назвою. Діти
            відкривають <code>{joinUrl}</code> і вводять код та своє імʼя — без
            пошти й пароля.
          </li>
          <li>
            <strong>Далі все саме.</strong> Щойно діти зіграють, у групі зʼявиться
            список із балами, а результати можна вивантажити в таблицю.
          </li>
        </ol>
      ) : (
        <ul className="groups__list">
          {groups.map((group) => (
            <li key={group.id} className="groups__item">
              <Link to={`/groups/${group.id}`} className="groups__name">
                {group.name}
              </Link>
              <span className="groups__code">{group.join_code}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Groups
