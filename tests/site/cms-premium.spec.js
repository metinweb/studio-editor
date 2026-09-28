import { test, expect } from '@playwright/test'
import { cmsPremiumTests } from '../helpers/cms-premium.js'
cmsPremiumTests(test, expect)

test('CMS lab shows real session status, history and inline export without a backend', async ({
  page,
}) => {
  await page.goto('/integration/cms.html')
  await expect(page.locator('#status')).toHaveText('saved · v1')
  await page.frameLocator('.studio-editor-frame').locator('body').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' A new draft.')
  await expect(page.locator('#status')).toHaveText('saved · v2')
  await page.getByRole('button', { name: 'Version history', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'CMS version history' })
  await dialog.getByRole('combobox', { name: 'Version', exact: true }).selectOption('v1')
  await dialog.getByRole('button', { name: 'Restore to draft' }).click()
  await expect(page.locator('#status')).toHaveText('saved · v3')
  await page.getByRole('button', { name: 'Inspect inline CSS HTML' }).click()
  await expect(page.locator('#html')).toContainText('font-family:')
})
