import { defineConfig, devices } from '@playwright/test'

const mobileSpecs = /mobile-[\w-]+\.spec\.js$/
const desktopIgnore = ['**/site/**', '**/screen-reader/**', '**/mobile-*.spec.js']

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/site/**', '**/screen-reader/**'],
  fullyParallel: true,
  workers: 4,
  timeout: 30000,
  // Existing interaction scenarios cover Turkish; locale.spec.js covers the English default.
  use: {
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
    {
      name: 'chromium',
      testIgnore: desktopIgnore,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'firefox',
      testIgnore: desktopIgnore,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'webkit',
      testIgnore: desktopIgnore,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1100 } },
    },
    // Phone profiles (mobile user agent, touch, device viewport and scale) for mobile-*.spec.js.
    // They exercise the Chromium and WebKit engines; physical devices still need manual checks.
    { name: 'mobile-chrome', testMatch: mobileSpecs, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testMatch: mobileSpecs, use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
