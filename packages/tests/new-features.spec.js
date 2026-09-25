import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').first().locator('body')
test('installed image worker exports WebP and advanced English dialogs stay scoped', async ({
  page,
}) => {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  const src = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 80
    c.height = 40
    c.getContext('2d').fillRect(0, 0, 80, 40)
    return c.toDataURL()
  })
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(`<p><img src="${src}" alt="Example"></p>`)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await page.getByLabel('Örnek dil').selectOption('en')
  await body(page).locator('img').dblclick()
  await expect(page.getByRole('dialog', { name: 'Image editor', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'WebP', exact: true }).click()
  await page.getByRole('slider', { name: 'Quality', exact: true }).fill('70')
  await page.getByRole('button', { name: 'Apply image', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('src', /^data:image\/webp/)
  await expect(page.frameLocator('.studio-editor-frame').nth(1).locator('body')).toHaveText(
    'İkinci belge',
  )
})
test('plugin commands respect host readonly state and remain undoable', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByLabel('Salt okunur örnek').check()
  await page.getByRole('button', { name: 'Örnek eklentiyi çalıştır' }).click()
  await expect(body(page)).not.toContainText('Eklenti metni')
  await page.getByLabel('Salt okunur örnek').uncheck()
  await page.getByRole('button', { name: 'Örnek eklentiyi çalıştır' }).click()
  await expect(body(page)).toContainText('Eklenti metni')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Birinci belge')
})
