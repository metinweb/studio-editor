import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/site/**',
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
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1100 } },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
