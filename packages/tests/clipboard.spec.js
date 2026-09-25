import { test, expect } from '@playwright/test'
const body = (page, index = 0) =>
  page.frameLocator('.studio-editor-frame').nth(index).locator('body')
async function paste(page, index = 0, file = false) {
  await body(page, index).evaluate((root, file) => {
    root.focus()
    const range = root.ownerDocument.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    const selection = root.ownerDocument.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    const data = new DataTransfer()
    data.setData('text/html', '<p class="MsoNormal"><strong>Yeni</strong></p>')
    data.setData('text/plain', 'Yeni')
    if (file) data.items.add(new File(['image'], 'pasted.png', { type: 'image/png' }))
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
  }, file)
}
test('installed package exposes reactive paste modes and metadata without leaking between editors', async ({
  page,
}) => {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption('clean')
  await paste(page)
  await expect(body(page).locator('strong')).toHaveCount(0)
  const info = JSON.parse(await page.locator('#paste-info').textContent())
  expect(info).toMatchObject({ source: 'word', mode: 'clean', inserted: true, warnings: [] })
  expect(info).not.toHaveProperty('html')
  await paste(page, 1)
  await expect(body(page, 1).locator('strong')).toHaveText('Yeni')
  const first = page.locator('.studio-editor-embed').first()
  await first.getByRole('button', { name: 'Düzenle', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Yapıştır: yalnızca metin', exact: true }).click()
  await expect(page.getByLabel('Yapıştırma modu', { exact: true })).toHaveValue('text')
})
test('a pending mixed paste cannot insert at an obsolete document revision', async ({ page }) => {
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  let started = false
  await page.route('**/api/media', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    started = true
    await pending
    await route.fulfill({
      json: { id: 'asset', name: 'pasted.png', type: 'image/png', size: 5, url: '/pasted.png' },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  await expect(body(page, 2)).toHaveText('Sunucu medyası')
  await paste(page, 2, true)
  await expect.poll(() => started).toBe(true)
  await page.keyboard.insertText(' değişti')
  release()
  await expect(page.getByText(/Yükleme sürerken belge değişti/)).toBeVisible()
  await expect(body(page, 2)).toHaveText('Sunucu medyası değişti')
  await expect(body(page, 2).locator('img')).toHaveCount(0)
})
