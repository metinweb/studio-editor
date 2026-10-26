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

test('paired editors show each other caret and selection with a name label', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'İki editörü eşleştir' }).click()
  await expect(body(page, 1)).toHaveText('Birinci belge')
  await body(page, 0).evaluate((root) => {
    const text = root.querySelector('p').firstChild
    const range = root.ownerDocument.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 7)
    root.focus()
    root.ownerDocument.getSelection().removeAllRanges()
    root.ownerDocument.getSelection().addRange(range)
  })
  const frame = page.frameLocator('.studio-editor-frame').nth(1)
  const caret = frame.locator('[data-studio-remote-caret="first"]')
  await expect(caret).toHaveCount(1)
  await expect(caret).toHaveText('Birinci editör')
  const position = await caret.evaluate((node) => node.getBoundingClientRect().left)
  const word = await body(page, 1).evaluate((root) => {
    const range = root.ownerDocument.createRange()
    range.setStart(root.querySelector('p').firstChild, 7)
    return range.getBoundingClientRect().left
  })
  expect(Math.abs(position - word)).toBeLessThan(3)
  await expect(page.locator('.studio-editor-embed').nth(1).locator('.presence-user')).toHaveText(
    'Birinci editör',
  )
  // The overlay is not part of the document.
  expect(await body(page, 1).evaluate((root) => root.innerHTML)).not.toContain('remote')
})
