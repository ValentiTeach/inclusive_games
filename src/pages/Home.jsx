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
import { useT } from '../i18n/i18n'
import './Home.css'

/*
 * Три входи за роллю. Дитина приходить на головну грати, а дорослий —
 * зрозуміти, що це і як почати. Досі дорослий бачив лише заголовок і кнопку
 * каталогу, і найсильніше в проєкті — адаптації, цілі ІПР, зріз «до/після»,
 * шифрований щоденник — лишалося невидимим.
 */
const ROLES = [
  { key: 'child', icon: Gamepad2, action: '/join', extra: '/games' },
  { key: 'teacher', icon: GraduationCap, action: '/login', extra: '/help#start-teacher' },
  { key: 'parent', icon: HeartHandshake, action: '/help#start-parent', extra: '/child' },
]

const STEPS = [
  { key: 'step1', icon: Users },
  { key: 'step2', icon: KeyRound },
  { key: 'step3', icon: Gamepad2 },
  { key: 'step4', icon: ChartLine },
]

const FOR_SPECIALISTS = ['home.pro.1', 'home.pro.2', 'home.pro.3', 'home.pro.4', 'home.pro.5', 'home.pro.6']

function Home() {
  const t = useT()
  return (
    <div className="home">
      <section className="home-hero">
        <h1>{t('home.title')}</h1>
        <p className="home-hero__lede">{t('home.lede')}</p>
        <div className="home-hero__actions">
          <Button to="/games">{t('home.catalog')}</Button>
        </div>

        {/* Раніше це були просто написи — чотири слова, які виглядали як кнопки,
            але нічого не робили. Тепер кожне веде до ігор саме на цей навик. */}
        <p className="home-hero__categories-label">{t('home.pickSkill')}</p>
        <ul className="home-hero__categories">
          {Object.entries(CATEGORIES).map(([key, category]) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <li key={key}>
                <Link to={`/games?category=${key}`} className="home-hero__category">
                  <Badge tone={category.color}>
                    <Icon size={13} aria-hidden="true" />
                    {t(`category.${key}`)}
                  </Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-roles">
        <h2 id="home-roles">{t('home.start')}</h2>
        <ul className="home-roles">
          {ROLES.map(({ key, icon: Icon, action, extra }) => (
            <li key={key} className="home-card">
              <h3 className="home-card__title">
                <Icon size={22} aria-hidden="true" />
                {t(`home.role.${key}.title`)}
              </h3>
              <p>{t(`home.role.${key}.text`)}</p>
              <div className="home-card__actions">
                <Button to={action}>{t(`home.role.${key}.action`)}</Button>
                <Link to={extra} className="home-card__link">
                  {t(`home.role.${key}.extra`)}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-how">
        <h2 id="home-how">{t('home.how')}</h2>
        <ol className="home-steps">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="home-card home-step">
              <span className="home-step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="home-card__title">
                <Icon size={20} aria-hidden="true" />
                {t(`home.${key}.title`)}
              </h3>
              <p>{t(`home.${key}.text`)}</p>
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
              alt={t('home.shot.games.alt')}
            />
            <figcaption>{t('home.shot.games.caption')}</figcaption>
          </figure>
          <figure className="home-shot">
            <img
              src="/screenshots/phone-progress.jpg"
              width="390"
              height="844"
              loading="lazy"
              alt={t('home.shot.progress.alt')}
            />
            <figcaption>{t('home.shot.progress.caption')}</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-section home-card home-specialists" aria-labelledby="home-pro">
        <h2 id="home-pro">
          <ClipboardList size={22} aria-hidden="true" /> {t('home.pro.title')}
        </h2>
        <p>{t('home.pro.lede')}</p>
        <ul className="home-specialists__list">
          {FOR_SPECIALISTS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="home-specialists__more">
          <Link to="/help#metrics">{t('home.pro.metrics')}</Link>
          {' · '}
          <Link to="/help#adaptations">{t('home.pro.adaptations')}</Link>
        </p>
      </section>

      <section className="home-section home-card home-note" aria-labelledby="home-disclaimer">
        <h2 id="home-disclaimer">{t('home.disclaimer.title')}</h2>
        <p>
          {t('home.disclaimer.text')} <Link to="/help#not-diagnosis">{t('home.disclaimer.more')}</Link>
        </p>
      </section>

      <section className="home-section" aria-labelledby="home-trust">
        <h2 id="home-trust" className="visually-hidden">
          {t('home.trust.title')}
        </h2>
        <ul className="home-trust">
          <li className="home-card">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              {t('home.trust.data')} <Link to="/privacy">{t('home.trust.dataLink')}</Link>
            </p>
          </li>
          <li className="home-card">
            <Lock size={20} aria-hidden="true" />
            <p>{t('home.trust.access', { months: RETENTION_MONTHS })}</p>
          </li>
          <li className="home-card">
            <Accessibility size={20} aria-hidden="true" />
            <p>
              {t('home.trust.a11y')} <Link to="/accessibility">{t('home.trust.a11yLink')}</Link>
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default Home
