import { Component } from 'react'
import { reportError } from '../../lib/errorLog'
import './ErrorBoundary.css'

/**
 * Межа, за яку падіння не проходить.
 *
 * Досі будь-яка помилка в малюванні знімала з екрана весь застосунок: React без
 * межі демонтує все дерево, і дитина лишалася з білим екраном — без пояснення,
 * без кнопки, без сліду. За цю сесію ми двічі ловили саме такі падіння, і обидва
 * рази їх знайшов тест, а не застосунок.
 *
 * Класовий компонент тут не за звичкою: componentDidCatch досі не має
 * відповідника серед хуків, і іншого способу перехопити помилку малювання
 * React не дає.
 */
class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  /*
   * Перехід на іншу сторінку скидає межу.
   *
   * Без цього дитина, яка потрапила на поламану сторінку, лишалася б на екрані
   * помилки назавжди: стан межі пережив би будь-яку навігацію, і застосунок
   * виглядав би зламаним цілком, хоча зламана одна сторінка.
   */
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error, info) {
    reportError(error, 'render', info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash" role="alert">
        <h1 className="crash__title">Щось пішло не так</h1>
        <p className="crash__text">
          Це не через тебе — зламалася сама сторінка. Спробуй ще раз, а якщо не
          допоможе — повернись до каталогу ігор.
        </p>
        <div className="crash__actions">
          {/*
            Перезавантаження, а не просто скидання стану: скидання перемалювало б
            той самий поламаний компонент, і він упав би знову тієї ж миті.
          */}
          <button
            type="button"
            className="crash__button crash__button--main"
            onClick={() => window.location.reload()}
          >
            Спробувати ще раз
          </button>
          {/*
            Звичайне посилання, а не Link: межа має працювати і тоді, коли
            зламався сам маршрутизатор.
          */}
          <a className="crash__button" href="/games">
            До каталогу ігор
          </a>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
