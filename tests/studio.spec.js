import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('iframe.studio-editor-frame').locator('body')
async function start(page) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
}
test('loads our editor without runtime errors and autosaves content', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await start(page)
  await page.getByRole('textbox', { name: 'Belge başlığı' }).fill('Kalıcı taslak')
  await body(page).fill('Merhaba Studio, kalıcı içerik.')
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Belge başlığı' })).toHaveValue('Kalıcı taslak')
  await expect(body(page)).toContainText('Merhaba Studio, kalıcı içerik.')
  expect(errors).toEqual([])
})

test('source highlights HTML, sanitizes scripts, applies and supports undo', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await expect(page.locator('.cm-line span').first()).toBeVisible()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      '<h2>Kaynak düzenlendi</h2><p>Yeni içerik</p><script>window.hacked=true</script><img src="x" onerror="alert(1)">',
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await expect(body(page)).toContainText('Kaynak düzenlendi')
  expect(await body(page).innerHTML()).not.toContain('<script')
  expect(await body(page).innerHTML()).not.toContain('onerror')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toContainText('İyi fikirler')
})

test('document switching flushes pending edits and keeps documents isolated', async ({ page }) => {
  await start(page)
  await page.getByRole('textbox', { name: 'Belge başlığı' }).fill('Birinci belge')
  await body(page).fill('Birinci belgenin içeriği')
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Belge başlığı' })).toHaveValue('Başlıksız belge')
  await expect(body(page)).toHaveText('')
  await page.getByRole('textbox', { name: 'Belge başlığı' }).fill('İkinci belge')
  await body(page).fill('İkinci belgenin içeriği')
  await page.getByRole('button', { name: 'Birinci belge', exact: true }).click()
  await expect(body(page)).toContainText('Birinci belgenin içeriği')
  await page.getByRole('button', { name: 'İkinci belge', exact: true }).click()
  await expect(body(page)).toContainText('İkinci belgenin içeriği')
})

test('media uploads, filters, inserts alt text and persists through reload', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  )
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({ name: 'test-gorsel.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.media-card')).toHaveCount(1)
  await page.getByPlaceholder('Görseli kısaca açıklayın').fill('Test açıklaması')
  await page.getByRole('button', { name: 'Belgeye ekle' }).click()
  await expect(body(page).locator('img[alt="Test açıklaması"]')).toHaveCount(1)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('img[alt="Test açıklaması"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Medya ara' }).fill('bulunmayan')
  await expect(page.getByText('Dosya bulunamadı', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Medya ara' }).fill('test')
  await expect(page.locator('.media-card')).toHaveCount(1)
})

test('rejects unsupported uploads with an actionable error', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await page.locator('dialog input[type=file]').setInputFiles({
    name: 'script.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<script>alert(1)</script>'),
  })
  await expect(page.getByRole('alert')).toContainText('desteklenmeyen dosya türü')
  await expect(page.locator('.media-card')).toHaveCount(0)
})

test('imports sanitized HTML and exports a standalone document', async ({ page }) => {
  await start(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'aktar.html',
    mimeType: 'text/html',
    buffer: Buffer.from(
      '<!doctype html><html><head><title>Aktarılan belge</title></head><body><h1>İçe aktarıldı</h1><p>İçerik</p><script>alert(1)</script></body></html>',
    ),
  })
  await expect(page.getByRole('textbox', { name: 'Belge başlığı' })).toHaveValue('Aktarılan belge')
  await expect(body(page)).toContainText('İçe aktarıldı')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dışa aktar', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Aktarılan belge.html')
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const exported = Buffer.concat(chunks).toString('utf8')
  expect(exported).toContain('<!doctype html>')
  expect(exported).toContain('İçe aktarıldı')
  expect(exported).not.toContain('<script')
})

test('preview is sandboxed and mobile layout has no horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Önizleme', exact: true }).click()
  await expect(page.locator('iframe[title="Belge önizlemesi"]')).toHaveAttribute('sandbox', '')
  await expect(page.frameLocator('iframe[title="Belge önizlemesi"]').locator('h1')).toContainText(
    'İyi fikirler',
  )
  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('button', { name: 'Menüyü aç' }).click()
  await expect(page.locator('.sidebar')).toHaveClass(/is-open/)
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true })
})

test('embedded video and audio survive while active data links are removed', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      '<p>Bir</p><p>İki</p><video controls src="data:video/mp4;base64,AAAA"></video><audio controls src="data:audio/mpeg;base64,AAAA"></audio><a href="data:text/html;base64,PHNjcmlwdD4=">Güvensiz</a>',
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await page.getByRole('button', { name: 'Önizleme', exact: true }).click()
  const preview = page.frameLocator('iframe[title="Belge önizlemesi"]')
  await expect(preview.locator('video')).toHaveAttribute('src', 'data:video/mp4;base64,AAAA')
  await expect(preview.locator('audio')).toHaveAttribute('src', 'data:audio/mpeg;base64,AAAA')
  await expect(preview.locator('a[href^="data:text/html"]')).toHaveCount(0)
  await expect(page.locator('.dialog-footer')).toContainText('3 kelime')
})

test('last document can be removed and a new empty document remains', async ({ page }) => {
  await start(page)
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('.delete-document').click()
  await expect(page.getByRole('textbox', { name: 'Belge başlığı' })).toHaveValue('Başlıksız belge')
  await expect(body(page)).toHaveText('')
  await expect(page.locator('.document-row')).toHaveCount(1)
})

test('PDF attachments survive source round-trips and HTML export', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await page.locator('dialog input[type=file]').setInputFiles({
    name: 'rehber.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%test'),
  })
  await page.getByRole('button', { name: 'Belgeye ekle' }).click()
  await expect(body(page).getByRole('link', { name: 'rehber.pdf' })).toHaveAttribute(
    'href',
    /^data:application\/pdf;base64,/,
  )
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await expect(body(page).getByRole('link', { name: 'rehber.pdf' })).toHaveAttribute(
    'href',
    /^data:application\/pdf;base64,/,
  )
  await page.getByRole('button', { name: 'Önizleme', exact: true }).click()
  await expect(
    page.frameLocator('iframe[title="Belge önizlemesi"]').getByRole('link', { name: 'rehber.pdf' }),
  ).toHaveAttribute('href', /^data:application\/pdf;base64,/)
})

test('storage errors preserve unsaved edits and prevent switching away', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (window.failWrites) throw new DOMException('Storage full', 'QuotaExceededError')
      return original.apply(this, args)
    }
  })
  await start(page)
  await page.evaluate(() => {
    window.failWrites = true
  })
  await body(page).fill('Kaybolmaması gereken değişiklik')
  await expect(page.getByRole('alert')).toContainText('Belge kaydedilemedi')
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await expect(body(page)).toContainText('Kaybolmaması gereken değişiklik')
  await expect(page.locator('.document-row')).toHaveCount(1)
  await page.evaluate(() => {
    window.failWrites = false
  })
  await page.getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await expect(body(page)).toContainText('Kaybolmaması gereken değişiklik')
})

test('media deletion keeps embedded document images intact', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await page.locator('dialog input[type=file]').setInputFiles({
    name: 'kalici.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.getByPlaceholder('Görseli kısaca açıklayın').fill('Kalıcı görsel')
  await page.getByRole('button', { name: 'Belgeye ekle' }).click()
  await expect(body(page).locator('img[alt="Kalıcı görsel"]')).toHaveCount(1)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await page.locator('.media-card').click()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Kütüphaneden sil' }).click()
  await expect(page.locator('.media-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Kapat', exact: true }).last().click()
  await page.reload()
  await expect(body(page).locator('img[alt="Kalıcı görsel"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(0)
})
