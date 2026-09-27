import { test, expect } from '@playwright/test'
const body = (page, index) => page.frameLocator('.studio-editor-frame').nth(index).locator('body')
test('writing settings remain isolated between embedded editor instances', async ({ page }) => {
  await page.goto('/')
  const editor = page.locator('.studio-editor-embed').first()
  await expect(body(page, 0)).toHaveText('Birinci belge')
  await editor
    .locator('.native-menubar')
    .getByRole('button', { name: 'Araçlar', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Otomatik düzeltme ve metin kısayolları', exact: true })
    .click()
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await page.getByRole('button', { name: 'Ayarları uygula', exact: true }).click()
  await body(page, 0).locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' teh ')
  await expect(body(page, 0)).toContainText(' the')
  await body(page, 1).locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' teh ')
  await expect(body(page, 1)).toContainText(' teh')
})
test('read-only instances can export Markdown without exposing writing configuration', async ({
  page,
}) => {
  await page.goto('/?mode=readonly')
  const editor = page.locator('.studio-editor-embed').first()
  await expect(body(page, 0)).toHaveAttribute('contenteditable', 'false')
  await editor
    .locator('.native-menubar')
    .getByRole('button', { name: 'Dosya', exact: true })
    .click()
  await expect(page.getByRole('menuitem', { name: 'Markdown içe aktar', exact: true })).toHaveCount(
    0,
  )
  await page.getByRole('menuitem', { name: 'Markdown dışa aktar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown metni' })).toHaveValue('Birinci belge')
  await expect(body(page, 0)).toHaveText('Birinci belge')
})
