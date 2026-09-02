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
    setupFiles: ['./src/test/setup.js'],
    // Playwright specs live in e2e/ and drive a real browser; Vitest must not
    // try to run them as unit tests.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}))
