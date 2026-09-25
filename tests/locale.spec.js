import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')

test('English is the default; switching languages preserves content and history across reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(body(page)).toContainText('Good ideas start')
  await expect(page.getByLabel('Interface language')).toHaveValue('en')
  await body(page).fill('My original document — İstanbul')
  await expect(page.locator('.save-state')).toHaveText('All changes saved')
  await page.getByLabel('Interface language').selectOption('tr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(body(page)).toHaveText('My original document — İstanbul')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toContainText('Good ideas start')
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(body(page)).toHaveText('My original document — İstanbul')
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(page.getByLabel('Arayüz dili')).toHaveValue('tr')
  await expect(body(page)).toHaveText('My original document — İstanbul')
  await page.getByLabel('Arayüz dili').selectOption('en')
  await page.reload()
  await expect(page.getByLabel('Interface language')).toHaveValue('en')
  await expect(body(page)).toHaveText('My original document — İstanbul')
})

test('English workspace dialogs and built-in templates are localized', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('Good ideas start')
  await page.getByRole('button', { name: 'Edit document tags' }).click()
  await expect(page.getByRole('dialog')).toContainText('Tags are saved automatically.')
  await page.getByRole('textbox', { name: 'New tag' }).fill('IDEAS')
  await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove tag IDEAS' })).toBeVisible()
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await page.getByLabel('Search documents', { exact: true }).fill('ideas')
  await expect(page.locator('.document-select')).toHaveCount(1)
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Project brief')
  await expect(page.frameLocator('iframe[title="Template preview"]').locator('body')).toContainText(
    'What do we want to achieve?',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Backup / restore', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Download full backup')
})

test('language links and mobile English controls fit without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/?lang=tr')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click()
  await page.getByLabel('Arayüz dili').selectOption('en')
  await expect(page).not.toHaveURL(/lang=/)
  await expect(page.getByLabel('Interface language')).toHaveValue('en')
  await expect(page.getByRole('button', { name: 'Backup / restore', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page
    .getByRole('button', { name: 'Close menu', exact: true })
    .click({ position: { x: 330, y: 100 } })
  await expect(body(page)).toContainText('İyi fikirler')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
