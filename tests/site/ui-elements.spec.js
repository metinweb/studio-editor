import { test, expect } from '@playwright/test'
import { uiElementTests } from '../helpers/ui-elements.js'
uiElementTests(test, expect)

test('UI playground exports native widgets, offers download and isolates preview submissions', async ({
  page,
}) => {
  await page.goto('/integration/ui.html')
  await expect(page.locator('#status')).toHaveText('Editor ready')
  await expect(page.frameLocator('.studio-editor-frame').locator('[data-studio-ui]')).toHaveCount(3)
  await page.getByRole('button', { name: 'Preview published HTML' }).click()
  const preview = page.frameLocator('#published')
  await expect(preview.locator('form')).toHaveCount(1)
  await expect(preview.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await preview.getByRole('link', { name: '3', exact: true }).click()
  await expect
    .poll(() => preview.getByRole('region').evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(100)
  await preview.getByText('Does the published page need Vue?', { exact: true }).click()
  await expect(preview.locator('details').first()).not.toHaveAttribute('open', '')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download HTML' }).click()
  expect((await downloaded).suggestedFilename()).toBe('studio-ui-elements.html')
})
