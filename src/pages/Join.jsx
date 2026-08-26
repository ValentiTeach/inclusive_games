import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { supabase, isCloudConfigured } from '../lib/supabaseClient'
import { joinGroup } from '../lib/groups'
import Button from '../components/ui/Button'
import './Join.css'

function Join() {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  if (!isCloudConfigured) {
    return (
      <section className="join">
        <h1>Приєднатися до групи</h1>
        <p>Ця можливість ще не підключена на цьому сайті.</p>
      </section>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    try {
      await joinGroup(code, name)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await refreshProfile(user)
      navigate('/games')
    } catch {
      setStatus('idle')
      setErrorMessage('Не вдалося приєднатися. Перевір код групи і спробуй ще раз.')
    }
  }

  return (
    <section className="join">
      <h1>Приєднатися до групи</h1>
      <p>Введи код, який дав тобі вчитель, і своє ім'я — пошта не потрібна.</p>

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

        <label className="join__label" htmlFor="name">
          Твоє ім'я
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="join__input"
          placeholder="Ім'я"
        />

        {errorMessage && <p className="join__error">{errorMessage}</p>}

        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Приєднуємось…' : 'Приєднатися'}
        </Button>
      </form>
    </section>
  )
}

export default Join
