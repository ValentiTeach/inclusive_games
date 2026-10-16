import Button from '../components/ui/Button'
import { useT } from '../i18n/i18n'

function NotFound() {
  const t = useT()
  return (
    <section>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.text')}</p>
      <Button to="/">{t('notFound.home')}</Button>
    </section>
  )
}

export default NotFound
