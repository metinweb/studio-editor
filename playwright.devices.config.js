import { defineConfig } from '@playwright/test'

// Real mobile browsers: Chrome on an Android emulator (adb) and Safari on an iOS Simulator
// (Appium). The tests drive the device themselves; Playwright only runs them and serves the app.
export default defineConfig({
  testDir: './tests/devices',
  outputDir: 'test-results/devices',
  timeout: 20 * 60 * 1000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  projects: [
    { name: 'android-chrome', testMatch: /android-chrome\.spec\.js$/ },
    { name: 'ios-safari', testMatch: /ios-safari\.spec\.js$/ },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
