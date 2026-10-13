import { Link } from 'react-router-dom'
import {
  Accessibility,
  ChartLine,
  ClipboardList,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { CATEGORIES } from '../data/games'
import { CATEGORY_ICONS } from '../data/categoryIcons'
import Badge from '../components/ui/Badge'
import { RETENTION_MONTHS } from '../lib/retention'
import './Home.css'

/*
 * Три входи за роллю. Дитина приходить на головну грати, а дорослий —
 * зрозуміти, що це і як почати. Досі дорослий бачив лише заголовок і кнопку
 * каталогу, і найсильніше в проєкті — адаптації, цілі ІПР, зріз «до/після»,
 * шифрований щоденник — лишалося невидимим.
 */
const ROLES = [
  {
    icon: Gamepad2,
    title: 'Я дитина',
    text: 'Маєш код від учителя? Введи його й своє ім’я — і грай.',
    action: { to: '/join', label: 'Ввести код групи' },
    extra: { to: '/games', label: 'Грати без коду' },
  },
  {
    icon: GraduationCap,
    title: 'Я вчитель чи фахівець',
    text: 'Створіть групу, дайте дітям код і бачте результати кожного — без пошти й паролів для дітей.',
    action: { to: '/login', label: 'Зареєструватися' },
    extra: { to: '/help#start-teacher', label: 'Як почати' },
  },
  {
    icon: HeartHandshake,
    title: 'Я з батьків',
    text: 'Бачте, як грає ваша дитина, друкуйте звіт і завантажуйте її дані — за кодом від учителя.',
    action: { to: '/help#start-parent', label: 'Як отримати доступ' },
    extra: { to: '/child', label: 'Уже маю код' },
  },
]

const STEPS = [
  {
    icon: Users,
    title: 'Учитель створює групу',
    text: 'І отримує код із шести знаків. Згоду батьків допомагає зібрати готовий бланк.',
  },
  {
    icon: KeyRound,
    title: 'Дитина вводить код',
    text: 'І своє ім’я — без пошти й пароля. На спільному комп’ютері кожна дитина має свій сеанс.',
  },
  {
    icon: Gamepad2,
    title: 'Грає кілька хвилин',
    text: 'Пробна гра, озвучені інструкції, «без поспіху» — щоб почати могла кожна дитина.',
  },
  {
    icon: ChartLine,
    title: 'Дорослі бачать поступ',
    text: 'Учитель — групу й кожну дитину, батьки — свою. Дитина порівнюється лише з собою.',
  },
]

const FOR_SPECIALISTS = [
  'Профіль адаптацій для кожної дитини: без обмеження часу, затримка активації, керування однією кнопкою, шрифт для дислексії, сенсорно-безпечний режим.',
  'Заняття за шаблоном: привітання й настрій, дихання, ігри, фізхвилинка, рефлексія — з візуальним розкладом для дитини.',
  'Зріз «до/після» на фіксованих рівнях і цілі ІПР із поточним значенням.',
  'Показники понад бал: розкид часу реакції, втома в другій половині спроби, імпульсивні натискання, «застрягання» після зміни правила.',
  'Вправи на основі відомих методик: Струп, Go/No-Go, Flanker, «Вежа» (Tower of London), Trail Making, «Десять слів» Лурії, сортування карток.',
  'Щоденник фахівця й настрій дитини шифруються в браузері — на сервері лише шифр.',
]

function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <h1>Ігри, що тренують увагу, пам’ять і мислення</h1>
        <p className="home-hero__lede">
          Короткі інтерактивні вправи для дітей: увага, пам’ять, логіка та швидкість
          реакції. Кожна гра — окрема вправа на пару хвилин, зручна для уроку чи
          домашнього тренування.
        </p>
        <div className="home-hero__actions">
          <Button to="/games">Переглянути каталог ігор</Button>
        </div>

        {/* Раніше це були просто написи — чотири слова, які виглядали як кнопки,
            але нічого не робили. Тепер кожне веде до ігор саме на цей навик. */}
        <p className="home-hero__categories-label">Обери навик:</p>
        <ul className="home-hero__categories">
          {Object.entries(CATEGORIES).map(([key, category]) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <li key={key}>
                <Link to={`/games?category=${key}`} className="home-hero__category">
                  <Badge tone={category.color}>
                    <Icon size={13} aria-hidden="true" />
                    {category.label}
                  </Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-roles">
        <h2 id="home-roles">З чого почати</h2>
        <ul className="home-roles">
          {ROLES.map(({ icon: Icon, title, text, action, extra }) => (
            <li key={title} className="home-card">
              <h3 className="home-card__title">
                <Icon size={22} aria-hidden="true" />
                {title}
              </h3>
              <p>{text}</p>
              <div className="home-card__actions">
                <Button to={action.to}>{action.label}</Button>
                <Link to={extra.to} className="home-card__link">
                  {extra.label}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-how">
        <h2 id="home-how">Як це працює</h2>
        <ol className="home-steps">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="home-card home-step">
              <span className="home-step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="home-card__title">
                <Icon size={20} aria-hidden="true" />
                {title}
              </h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <div className="home-shots">
          <figure className="home-shot">
            <img
              src="/screenshots/phone-games.jpg"
              width="390"
              height="844"
              loading="lazy"
              alt="Каталог ігор на телефоні: картки ігор з навичками"
            />
            <figcaption>Каталог: кожна гра — на один навик</figcaption>
          </figure>
          <figure className="home-shot">
            <img
              src="/screenshots/phone-progress.jpg"
              width="390"
              height="844"
              loading="lazy"
              alt="Сторінка «Мій прогрес»: серія днів, мета дня й досягнення"
            />
            <figcaption>Прогрес дитини: порівняння лише з собою</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-section home-card home-specialists" aria-labelledby="home-pro">
        <h2 id="home-pro">
          <ClipboardList size={22} aria-hidden="true" /> Для фахівців
        </h2>
        <p>
          Для корекційних педагогів, логопедів, психологів і нейропсихологів — не лише ігри, а
          робочий інструмент.
        </p>
        <ul className="home-specialists__list">
          {FOR_SPECIALISTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="home-specialists__more">
          <Link to="/help#metrics">Що означає кожен показник</Link>
          {' · '}
          <Link to="/help#adaptations">Як налаштувати адаптації</Link>
        </p>
      </section>

      <section className="home-section home-card home-note" aria-labelledby="home-disclaimer">
        <h2 id="home-disclaimer">Це тренування, а не діагностика</h2>
        <p>
          Частина ігор побудована на відомих методиках, але тут вони — вправи без вікових норм і
          контрольованих умов. Бал не є діагнозом і не замінює обстеження фахівцем.{' '}
          <Link to="/help#not-diagnosis">Детальніше</Link>
        </p>
      </section>

      <section className="home-section" aria-labelledby="home-trust">
        <h2 id="home-trust" className="visually-hidden">
          Дані та доступність
        </h2>
        <ul className="home-trust">
          <li className="home-card">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              Про дитину — лише ім’я, група й результати. Без пошти, телефону й фото, без реклами
              й стежильних скриптів. <Link to="/privacy">Як ми бережемо дані</Link>
            </p>
          </li>
          <li className="home-card">
            <Lock size={20} aria-hidden="true" />
            <p>
              Батьки бачать лише свою дитину, і лише після перевірки модератором. Дані видаляються
              на запит або через {RETENTION_MONTHS} місяців без занять.
            </p>
          </li>
          <li className="home-card">
            <Accessibility size={20} aria-hidden="true" />
            <p>
              Клавіатура, одна кнопка, озвучення, шрифт для дислексії, без поспіху.{' '}
              <Link to="/accessibility">Що зроблено для доступності</Link>
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default Home
