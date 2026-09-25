import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './packages/tests',
  outputDir: 'package-test-results',
  fullyParallel: true,
  workers: 3,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --config .package-smoke/vite.config.mjs --port 4174 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
