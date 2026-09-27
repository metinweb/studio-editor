import { test, expect } from '@playwright/test'
test('workspace content CSS persists and appears in preview without changing saved HTML', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('studio-locale', 'en'))
  await page.route('**/website-article.css', (route) =>
    route.fulfill({
      contentType: 'text/css',
      body: 'body { color: rgb(20, 60, 100); } h1 { font-size: 39px; }',
    }),
  )
  await page.goto('/')
  const content = page.frameLocator('.studio-editor-frame').locator('body')
  await expect(content).toBeVisible()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Content style settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Content style settings' })
  await dialog.getByRole('textbox', { name: 'External CSS URLs' }).fill('/website-article.css')
  await dialog.getByRole('button', { name: 'Apply styles' }).click()
  await expect(dialog).toContainText('Loaded')
  await page.keyboard.press('Escape')
  await expect(content).toHaveCSS('color', 'rgb(20, 60, 100)')
  await page.reload()
  await expect(content).toHaveCSS('color', 'rgb(20, 60, 100)')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Document preview', exact: true }).click()
  await expect(page.getByRole('dialog').locator('iframe').contentFrame().locator('body')).toHaveCSS(
    'color',
    'rgb(20, 60, 100)',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Source code', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'HTML source code' })).not.toContainText(
    /website-article.css/,
  )
})
