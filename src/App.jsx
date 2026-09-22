import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import { PAGES } from './routes'

/*
 * Сторінки за межами головної та каталогу вантажаться окремими шматками.
 *
 * Home і Catalog лишаються в основному: з них починається майже кожен візит, і
 * винести їх означало б додати очікування туди, де його зараз немає.
 *
 * Найбільше виграють від цього телефони в школі: учительські сторінки —
 * групи, зріз за іграми, адмінка, друкований звіт — дитина не відкриває
 * жодного разу, а досі завантажувала щоразу.
 */
const {
  GamePage,
  Progress,
  ChildProgress,
  Settings,
  Account,
  Groups,
  GroupDetail,
  Join,
  Login,
  Admin,
  NotFound,
} = PAGES

function App() {
  return (
    <AuthProvider>
      {/*
       * Порожній fallback, а не «Завантаження…»: шматок сторінки приходить за
       * частки секунди, і напис, що блимнув і зник, читається як збій. Місце під
       * заголовок тримає Layout, тож стрибка розмітки теж немає.
       */}
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/games" element={<Catalog />} />
            <Route path="/games/:gameId" element={<GamePage />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account" element={<Account />} />
            <Route path="/login" element={<Login />} />
            <Route path="/child" element={<ChildProgress />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            <Route path="/join" element={<Join />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
