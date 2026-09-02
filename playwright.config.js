import { defineConfig, devices } from '@playwright/test'

// Firefox is listed but skipped unless PW_FIREFOX=1: the browser isn't part of
// the default install here, and `playwright install firefox` is blocked by the
// network policy. Run `npx playwright install firefox && PW_FIREFOX=1 npm run
// test:e2e` on a machine that can fetch it to check Firefox rendering.
// Some sandboxes ship a Chromium build that predates the one this Playwright
// version would download, and downloading is blocked there. PW_CHROMIUM_PATH
// points the run at whatever build is already on the machine; unset, Playwright
// resolves its own as usual.
const chromiumLaunch = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {}

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch, channel: undefined },
  },
]

if (process.env.PW_FIREFOX === '1') {
  projects.push({ name: 'firefox', use: { ...devices['Desktop Firefox'] } })
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects,
  // Tests run against the production build, not the dev server, so what they
  // check is what actually ships.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Placeholder credentials so the auth-aware screens render their real UI
    // rather than the "sign-in isn't connected here" fallback. Nothing in these
    // tests calls Supabase, so the values only need to be non-empty.
    env: {
      VITE_SUPABASE_URL: 'https://e2e.invalid',
      VITE_SUPABASE_ANON_KEY: 'e2e-placeholder-anon-key',
    },
  },
})
