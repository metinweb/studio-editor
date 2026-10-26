import { defineConfig, devices } from '@playwright/test'
import { screenReaderConfig } from '@guidepup/playwright'

// Real screen readers through Guidepup: NVDA on Windows (Chromium) and VoiceOver on macOS
// (WebKit). They control the operating system, so tests run one at a time in headed browsers.
// Install the screen reader assets once with `npx @guidepup/setup install`.
export default defineConfig({
  ...screenReaderConfig,
  testDir: './tests/screen-reader',
  outputDir: 'test-results/screen-reader',
  timeout: 5 * 60 * 1000,
  retries: process.env.CI ? 2 : 0,
  reportSlowTests: null,
  use: {
    ...screenReaderConfig.use,
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    storageState: {
      cookies: [],
      origins: [
        { origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'studio-locale', value: 'tr' }] },
      ],
    },
  },
  projects: [
    { name: 'nvda', use: { ...devices['Desktop Chrome'], headless: false } },
    { name: 'voiceover', use: { ...devices['Desktop Safari'], headless: false } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
