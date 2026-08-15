import Button from '../components/ui/Button'

function NotFound() {
  return (
    <section>
      <h1>Сторінку не знайдено</h1>
      <p>Такої сторінки не існує. Можливо, вона ще не створена.</p>
      <Button to="/">На головну</Button>
    </section>
  )
}

export default NotFound
