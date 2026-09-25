import { test, expect } from '@playwright/test'
const body = (page, n) => page.frameLocator('.studio-editor-frame').nth(n).locator('body')
async function type(page, n, text) {
  await body(page, n).locator('p').click()
  await body(page, n).focus()
  await page.keyboard.press('End')
  await page.keyboard.type(text)
}
test('live binding merges offline edits and local undo preserves the peer contribution', async ({
  page,
}) => {
  await page.goto('/')
  await expect(body(page, 1)).toHaveText('İkinci belge')
  await page.getByRole('button', { name: 'İki editörü eşleştir' }).click()
  await expect(body(page, 1)).toHaveText('Birinci belge')
  await type(page, 0, ' A')
  await expect(body(page, 1)).toHaveText('Birinci belge A')
  await page.getByRole('button', { name: 'Bağlantıyı kes' }).click()
  await type(page, 0, ' X')
  await type(page, 1, ' Y')
  await expect(body(page, 0)).toHaveText('Birinci belge A X')
  await expect(body(page, 1)).toHaveText('Birinci belge A Y')
  await page.getByRole('button', { name: 'Yeniden bağlan' }).click()
  await expect.poll(async () => await body(page, 0).textContent()).toMatch(/X.*Y|Y.*X/)
  expect(await body(page, 0).textContent()).toBe(await body(page, 1).textContent())
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(body(page, 0)).toContainText('Y')
  await expect(body(page, 0)).not.toContainText('X')
  expect(await body(page, 0).textContent()).toBe(await body(page, 1).textContent())
  await expect(page.locator('#model-error')).toBeEmpty()
})
