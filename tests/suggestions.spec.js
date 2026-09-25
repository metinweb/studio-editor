import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function setup(page) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill('<p>Eski metin</p>')
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await body(page).evaluate((root) => {
    root.focus()
    const r = root.ownerDocument.createRange()
    r.selectNodeContents(root.firstChild)
    const s = root.ownerDocument.getSelection()
    s.removeAllRanges()
    s.addRange(r)
    root.ownerDocument.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('button', { name: 'Öneriler', exact: true }).first().click()
  await page.getByRole('textbox', { name: 'Önerilen metin' }).fill('Yeni metin')
  await page.getByRole('button', { name: 'Değişiklik öner', exact: true }).click()
  await expect(body(page).locator('[data-studio-suggestion]')).toHaveText('Eski metin')
}
test('suggestions persist and accept/reject are undoable without publishing proposal metadata', async ({
  page,
}) => {
  await setup(page)
  await expect(page.locator('.save-state')).toContainText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('[data-studio-suggestion]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Öneriler', exact: true }).first().click()
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect(body(page)).toHaveText('Yeni metin')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('[data-studio-suggestion]')).toHaveText('Eski metin')
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(body(page)).toHaveText('Eski metin')
  await expect(body(page).locator('[data-studio-suggestion]')).toHaveCount(0)
})
test('editing a proposed passage blocks stale acceptance and rejection preserves current edits', async ({
  page,
}) => {
  await setup(page)
  await body(page)
    .locator('[data-studio-suggestion]')
    .evaluate((node) => {
      node.textContent = 'Daha yeni metin'
      node.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }),
      )
    })
  await expect(page.getByRole('button', { name: 'Kabul et', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(body(page)).toHaveText('Daha yeni metin')
})
