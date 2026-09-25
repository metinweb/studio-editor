import { test, expect } from '@playwright/test'

test('landing page loads its assets and opens the working editor demo', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Give your words')
  for (const image of await page.locator('img').all())
    expect(await image.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)
  await page.getByRole('link', { name: 'Features', exact: true }).click()
  await expect(page).toHaveURL(/#features$/)
  await page.getByRole('link', { name: 'Try the editor', exact: false }).click()
  await expect(page).toHaveURL(/\/demo\/$/)
  const body = page.frameLocator('.studio-editor-frame').locator('body')
  await expect(body).toContainText('Good ideas')
  await body.fill('GitHub Pages demo save')
  await expect(page.locator('.save-state')).toHaveText('All changes saved')
  await page.reload()
  await expect(body).toContainText('GitHub Pages demo save')
  expect(errors).toEqual([])
})

test('installation commands copy and clipboard denial offers a selection fallback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Commands copied.')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'git clone https://github.com/metinweb/studio-editor.git',
  )
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error('denied')
    }
  })
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Ctrl/Cmd+C')
  expect(await page.evaluate(() => getSelection().toString())).toContain('npm run dev')
})

test('landing remains readable on phones and at enlarged text size', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try the editor', exact: false })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Turkish landing keeps valid assets and opens a Turkish demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Türkçe', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kelimelerinize')
  for (const image of await page.locator('img').all())
    expect(await image.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)
  await page.getByRole('link', { name: 'Editörü deneyin' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.frameLocator('.studio-editor-frame').locator('body')).toContainText(
    'İyi fikirler',
  )
})
