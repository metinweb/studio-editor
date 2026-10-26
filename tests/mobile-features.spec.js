import { test, expect } from '@playwright/test'

// Runs in the mobile-chrome (Pixel 7) and mobile-safari (iPhone 14) projects: mobile user
// agent, touch input and phone viewport. tests/devices runs a session in the real Android and
// iOS browsers; physical phones still need manual sessions.
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const noHorizontalScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('typing, the toolbar overflow and dark theme work on a phone', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(1)
  await body(page).locator('h1').tap()
  await page.keyboard.press('End')
  await page.keyboard.type(' telefondan')
  await expect(body(page).locator('h1')).toContainText('telefondan')
  const overflow = page.getByRole('button', { name: 'Tüm araçları göster' })
  await overflow.tap()
  await expect(page.getByRole('button', { name: 'Araçları daralt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Görev listesi', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Araçları daralt' }).tap()
  const theme = page.getByRole('combobox', { name: 'Görünüm teması' })
  if (await theme.isVisible()) {
    await theme.selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'dark')
    const sheet = await page
      .frameLocator('.studio-editor-frame')
      .locator('html')
      .evaluate((html) => getComputedStyle(html).backgroundColor)
    expect(sheet).toBe('rgb(255, 255, 255)')
  }
  expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(1)
})

test('track changes, the review panel and page view work on a phone', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  const menubar = page.locator('.native-menubar')
  await menubar.getByRole('button', { name: 'Araçlar', exact: true }).tap()
  await page.getByRole('menuitem', { name: 'Değişiklikleri izle' }).tap()
  await body(page).locator('h1').tap()
  await page.keyboard.press('End')
  await page.keyboard.type(' mobil')
  await expect(body(page).locator('ins[data-studio-change="insert"]')).toHaveText(' mobil')
  await menubar.getByRole('button', { name: 'Araçlar', exact: true }).tap()
  await page.getByRole('menuitem', { name: 'İzlenen değişiklikler' }).tap()
  const panel = page.getByRole('complementary', { name: 'Belge inceleme' })
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  const width = page.viewportSize().width
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
  await panel.locator('.change-card').getByRole('button', { name: 'Kabul et' }).tap()
  await expect(body(page).locator('ins')).toHaveCount(0)
  await expect(body(page).locator('h1')).toContainText('mobil')
  await page.getByRole('button', { name: 'İnceleme panelini kapat' }).tap()
  await menubar.getByRole('button', { name: 'Görünüm', exact: true }).tap()
  await page.getByRole('menuitem', { name: 'Sayfa görünümü' }).tap()
  await expect(page.locator('.page-count')).toHaveText(/^Sayfa \d+ \/ \d+$/)
  // The sheet is wider than the phone; the editing frame scrolls, not the page.
  expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(1)
})
