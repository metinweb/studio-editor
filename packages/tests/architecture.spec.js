import { test, expect } from '@playwright/test'
const content = (page, index = 0) =>
  page.frameLocator('.studio-editor-frame').nth(index).locator('body')
const read = async (page, id) => JSON.parse(await page.locator(`#${id}`).textContent())

test('transaction revisions, stable blocks and patch history survive local edits and undo', async ({
  page,
}) => {
  await page.goto('/')
  await expect(content(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  const original = await read(page, 'document-state')
  await page.getByRole('button', { name: "Aynı HTML'i uygula", exact: true }).click()
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  expect(await read(page, 'document-state')).toEqual(original)
  expect((await read(page, 'history-stats')).undo).toBe(0)
  await content(page).locator('p').click()
  await content(page).focus()
  await page.keyboard.press('End')
  await page.keyboard.type(' test')
  await expect(content(page)).toContainText('test')
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  const changed = await read(page, 'document-state')
  const transaction = await read(page, 'transaction')
  expect(changed.blockIds).toEqual(original.blockIds)
  expect(changed.html).toContain('test')
  expect(changed.html).not.toContain(original.blockIds[0])
  expect(transaction.schemaVersion).toBe(1)
  expect(transaction.origin).toBe('local')
  expect(transaction.revision).toBe(transaction.baseRevision + 1)
  expect(transaction.steps[0].type).toBe('replaceHtml')
  expect(transaction.mapping[0].blockId).toBe(original.blockIds[0])
  expect((await read(page, 'history-stats')).undo).toBe(1)
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(content(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  expect((await read(page, 'document-state')).blockIds).toEqual(original.blockIds)
  expect((await read(page, 'transaction')).origin).toBe('undo')
})

test('custom media provider retries errors, rejects unsafe URLs and stays isolated from local library', async ({
  page,
}) => {
  let uploads = 0
  const asset = {
    id: 'remote-1',
    name: 'server.png',
    type: 'image/png',
    size: 100,
    url: '/server.png',
    alt: '',
    createdAt: 1,
  }
  await page.route('**/api/media', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    uploads++
    if (uploads === 1) return route.fulfill({ status: 500, body: 'failed' })
    if (uploads === 2) return route.fulfill({ json: { ...asset, url: 'javascript:alert(1)' } })
    return route.fulfill({ json: asset })
  })
  await page.route('**/api/media/remote-1', (route) =>
    route.fulfill({ json: { ...asset, alt: 'Sunucu görseli' } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  const remote = page.locator('.studio-editor-embed').nth(2)
  await remote.getByRole('button', { name: 'Medya kütüphanesini aç' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .locator('input[type=file]')
    .setInputFiles({ name: 'server.png', mimeType: 'image/png', buffer: Buffer.from('test') })
  await expect(dialog.getByRole('alert')).toContainText('500')
  await dialog.getByRole('button', { name: /Başarısız yüklemeleri tekrar dene/ }).click()
  await expect(dialog.getByRole('alert')).toContainText('geçersiz')
  await dialog.getByRole('button', { name: /Başarısız yüklemeleri tekrar dene/ }).click()
  await expect(dialog.locator('.media-card')).toHaveCount(1)
  await dialog.locator('.media-card').click()
  await dialog.getByRole('button', { name: 'Belgeye ekle', exact: true }).click()
  await expect(content(page, 2).locator('img')).toHaveAttribute('src', '/server.png')
  await expect(content(page).locator('img')).toHaveCount(0)
  await page
    .locator('.studio-editor-embed')
    .first()
    .getByRole('button', { name: 'Medya kütüphanesini aç' })
    .click()
  await expect(page.getByRole('dialog').locator('.media-card')).toHaveCount(0)
})

test('cancelling a provider upload or unmounting never inserts a late result', async ({ page }) => {
  let pending
  await page.route('**/api/media', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    pending = route
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  await page
    .locator('.studio-editor-embed')
    .nth(2)
    .getByRole('button', { name: 'Medya kütüphanesini aç' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .locator('input[type=file]')
    .setInputFiles({ name: 'pending.png', mimeType: 'image/png', buffer: Buffer.from('test') })
  await expect.poll(() => !!pending).toBe(true)
  await expect(dialog.getByRole('progressbar', { name: 'Yükleme ilerlemesi' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Yüklemeyi iptal et' }).click()
  await expect(dialog.getByRole('alert')).toContainText('iptal')
  await pending
    ?.fulfill({
      json: { id: 'late', name: 'late.png', type: 'image/png', size: 4, url: '/late.png' },
    })
    .catch(() => {})
  await expect(dialog.locator('.media-card')).toHaveCount(0)
  await expect(content(page, 2).locator('img')).toHaveCount(0)
  pending = null
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'unmount.png',
    mimeType: 'image/png',
    buffer: Buffer.from('test'),
  })
  await expect.poll(() => !!pending).toBe(true)
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).last().click()
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  await expect(page.locator('.studio-editor-frame')).toHaveCount(2)
  await pending
    .fulfill({
      json: {
        id: 'unmounted',
        name: 'unmounted.png',
        type: 'image/png',
        size: 4,
        url: '/late.png',
      },
    })
    .catch(() => {})
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  await page
    .locator('.studio-editor-embed')
    .nth(2)
    .getByRole('button', { name: 'Medya kütüphanesini aç' })
    .click()
  await expect(dialog.locator('.media-card')).toHaveCount(0)
  await expect(content(page, 2).locator('img')).toHaveCount(0)
})
