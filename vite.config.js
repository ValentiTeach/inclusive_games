import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Версія збірки для журналу падінь і відгуків (src/lib/build.js). Vite сам
 * віддає застосунку змінні середовища з префіксом VITE_, тож досить покласти
 * її в process.env до того, як він їх прочитає.
 */
process.env.VITE_APP_BUILD ??=
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? `local-${new Date().toISOString().slice(0, 10)}`

/*
 * Заголовки безпеки живуть у vercel.json, а E2E ганяє `vite preview`, який
 * про vercel.json нічого не знає. Без цього весь набір тестів ішов би без CSP
 * — і зламаний CSP першою побачила б дитина на проді.
 *
 * Тому preview віддає ті самі заголовки, з однією поправкою: у тестах Supabase
 * живе на іншому домені (https://e2e.invalid), і його треба дописати до
 * connect-src, інакше браузер не дав би тестам навіть підмінити відповідь.
 */
function previewHeaders(env) {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
  const everywhere = vercel.headers.find((rule) => rule.source === '/(.*)')
  const headers = Object.fromEntries(everywhere.headers.map(({ key, value }) => [key, value]))

  const supabase = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : null
  const csp = headers['Content-Security-Policy']
  if (supabase && !csp.includes(supabase)) {
    headers['Content-Security-Policy'] = csp.replace('connect-src ', `connect-src ${supabase} `)
  }
  return headers
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  preview: { headers: previewHeaders(loadEnv(mode, process.cwd(), 'VITE_')) },
  // Vitest transforms test files with esbuild, which defaults to the classic
  // JSX runtime and leaves React undefined in a test file's own JSX. The
  // production build goes through the react plugin's Oxc transform instead,
  // where this option is ignored and only emits a warning — hence test-only.
  ...(mode === 'test' ? { esbuild: { jsx: 'automatic' } } : {}),
  test: {
    environment: 'jsdom',
    globals: true,
    /*
     * Тести йдуть за київським часом, а не за тим, що трапиться на машині.
     *
     * Аудиторія живе в Україні, і саме там UTC-доба розходиться з календарною:
     * усе, що між північчю і третьою ночі, за Гринвічем ще вчора. І тут, і на
     * раннері GitHub час UTC — без цього рядка жоден тест не побачив би
     * різниці, заради якої день і переписувався на місцевий.
     *
     * Тут, а не в setup.js: ESM піднімає імпорти вище за будь-який код у файлі,
     * тож присвоєння process.env.TZ там відбулося б уже після завантаження
     * модулів — покладатися на такий порядок не можна.
     */
    env: { TZ: 'Europe/Kyiv' },
    setupFiles: ['./src/test/setup.js'],
    // Playwright specs live in e2e/ and drive a real browser; Vitest must not
    // try to run them as unit tests.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}))
