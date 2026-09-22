import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
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
