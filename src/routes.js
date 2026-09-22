import { lazy } from 'react'

/*
 * Завантажувачі сторінок окремо від самих lazy-компонентів.
 *
 * Причина та сама, що й у реєстрі ігор: витягти функцію назад із lazy() можна
 * тільки через внутрішні поля React. А випередженню на простої (lib/prefetch)
 * потрібні саме функції — інакше нічим прогріти кеш для офлайну.
 *
 * Home і Catalog тут навмисно відсутні: вони лишаються в основному шматку, бо з
 * них починається майже кожен візит.
 */
const PAGE_LOADERS = {
  GamePage: () => import('./pages/GamePage'),
  Progress: () => import('./pages/Progress'),
  ChildProgress: () => import('./pages/ChildProgress'),
  Settings: () => import('./pages/Settings'),
  Account: () => import('./pages/Account'),
  Groups: () => import('./pages/Groups'),
  GroupDetail: () => import('./pages/GroupDetail'),
  Join: () => import('./pages/Join'),
  Login: () => import('./pages/Login'),
  Admin: () => import('./pages/Admin'),
  NotFound: () => import('./pages/NotFound'),
}

export const PAGES = Object.fromEntries(
  Object.entries(PAGE_LOADERS).map(([name, load]) => [name, lazy(load)]),
)

export function preloadAllPages() {
  for (const load of Object.values(PAGE_LOADERS)) {
    void load().catch(() => {})
  }
}
