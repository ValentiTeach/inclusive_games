import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { DEFAULT_SITE_URL, pageMetaFor } from '../data/seo'

/*
 * Адреса сайту для canonical і og:url. Прев'ю на Vercel має власну адресу, але
 * canonical має вказувати на справжній сайт — інакше пошуковик проіндексує
 * копію з прев'ю як окрему сторінку.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

/** Знаходить тег у <head> або створює, якщо його немає. */
function headTag(selector, create) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  return element
}

function setMeta(attribute, name, content) {
  const element = headTag(`meta[${attribute}="${name}"]`, () => {
    const meta = document.createElement('meta')
    meta.setAttribute(attribute, name)
    return meta
  })
  element.setAttribute('content', content)
}

/**
 * Ставить назву вкладки, опис, canonical і og:* під поточну сторінку.
 *
 * Не через <title> у JSX, хоч React 19 і вміє його піднімати в <head>: у
 * index.html уже є статичні теги (для месенджерів, що не виконують JS), і
 * React додав би поруч другі, а не замінив перші. Один хук у Layout міняє
 * наявні — і для кожної сторінки разом, без жодного рядка в самих сторінках.
 */
export function applyPageMeta(pathname) {
  const meta = pageMetaFor(pathname)
  const url = SITE_URL + (meta.path === '/' ? '/' : meta.path)

  document.title = meta.title
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', url)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)

  headTag('link[rel="canonical"]', () => {
    const link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    return link
  }).setAttribute('href', url)

  // Особисті сторінки (групи, адмінка, прогрес дитини) — не для видачі.
  const robots = document.head.querySelector('meta[name="robots"]')
  if (meta.index) robots?.remove()
  else setMeta('name', 'robots', 'noindex')

  return meta
}

export function usePageMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    applyPageMeta(pathname)
  }, [pathname])
}
