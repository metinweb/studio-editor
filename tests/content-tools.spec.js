import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function start(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function menu(page, name, item) {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
async function select(page, selector) {
  await body(page).locator(selector).selectText()
}
async function exportText(page) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dışa aktar', exact: true }).click()
  const stream = await (await pending).createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

test('comments span blocks, persist replies and resolved state, and stay out of exported HTML', async ({
  page,
}) => {
  await start(page, '<p>Bir <strong>öneri</strong></p><p>İkinci bölüm</p>')
  await body(page).evaluate((root) => {
    const range = root.ownerDocument.createRange()
    range.setStart(root.firstChild.firstChild, 0)
    range.setEnd(root.lastChild.firstChild, 6)
    root.focus()
    const selection = root.ownerDocument.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await page.getByRole('textbox', { name: 'Yeni yorum', exact: true }).fill('Özel not: örnek ekle')
  await page.getByRole('button', { name: 'Yorum ekle', exact: true }).click()
  await expect(page.locator('.comment-card')).toHaveCount(1)
  await expect(body(page).locator('span p')).toHaveCount(0)
  await expect(body(page).locator('strong')).toHaveText('öneri')
  await page.getByRole('textbox', { name: 'Yoruma yanıt', exact: true }).fill('Özel yanıt: tamam')
  await page.getByRole('button', { name: 'Yanıtı ekle' }).click()
  await expect(page.locator('.comment-message')).toHaveCount(2)
  await page.getByRole('button', { name: 'Çözüldü', exact: true }).click()
  await expect(page.locator('.comment-card')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Çözülenleri göster' }).check()
  await expect(page.locator('.comment-card.resolved')).toHaveCount(1)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Çözülenleri göster' }).check()
  await expect(page.locator('.comment-message')).toHaveCount(2)
  const html = await exportText(page)
  expect(html).not.toMatch(/Özel not|Özel yanıt|data-studio-thread|data-studio-resolved/)
  expect(html).toContain('öneri')
})

test('comments survive clearing formatting, delete with undo and stay isolated between documents', async ({
  page,
}) => {
  await start(page, '<p><strong>Yorumlanacak metin</strong></p>')
  await select(page, 'strong')
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await page.getByRole('textbox', { name: 'Yeni yorum', exact: true }).fill('Belgeye özel')
  await page.getByRole('button', { name: 'Yorum ekle', exact: true }).click()
  await select(page, 'p')
  await page.getByRole('button', { name: 'Biçimlendirmeyi temizle', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveCount(0)
  await expect(page.locator('.comment-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Yorumu sil', exact: true }).click()
  await expect(body(page).locator('[data-studio-thread]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(page.locator('.comment-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await expect(page.locator('.comment-card')).toHaveCount(0)
})

test('templates escape variables, insert with undo and personal templates persist', async ({
  page,
}) => {
  await start(page, '<p>Kişisel belge içeriği</p>')
  await page.getByRole('button', { name: 'Şablonlar', exact: true }).click()
  await page.getByRole('textbox', { name: 'Şablon adı', exact: true }).fill('Kendi düzenim')
  await page.getByRole('button', { name: 'Şablonu kaydet', exact: true }).click()
  await expect(page.getByText('Şablon kaydedildi.', { exact: true })).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Şablon başlığı', exact: true })
    .fill('<img src=x onerror=alert(1)>')
  await expect(page.frameLocator('iframe[title="Şablon önizlemesi"]').locator('h1')).toHaveText(
    '<img src=x onerror=alert(1)>',
  )
  await expect(page.frameLocator('iframe[title="Şablon önizlemesi"]').locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Şablonu ekle', exact: true }).click()
  await expect(body(page).locator('h1')).toHaveText('<img src=x onerror=alert(1)>')
  await expect(body(page)).toContainText('Kişisel belge içeriği')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Şablonlar', exact: true }).click()
  await page.getByRole('button', { name: 'Kendi düzenim', exact: true }).click()
  await expect(page.frameLocator('iframe[title="Şablon önizlemesi"]').locator('body')).toHaveText(
    'Kişisel belge içeriği',
  )
  await page.getByRole('button', { name: 'Kendi düzenim şablonunu sil', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Şablon başlığı', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kendi düzenim', exact: true })).toHaveCount(0)
})

test('advanced table sorting is numeric, preserves header and can be undone', async ({ page }) => {
  await start(
    page,
    '<table><tbody><tr><th>Ad</th><th>Sayı</th></tr><tr><td>On</td><td>10</td></tr><tr><td>İki</td><td>2</td></tr><tr><td>Bir</td><td>1</td></tr></tbody></table>',
  )
  await body(page).locator('td').nth(1).click()
  await menu(page, 'Tablo', 'Seçili sütuna göre A → Z')
  await expect(body(page).locator('tr td:first-child')).toHaveText(['Bir', 'İki', 'On'])
  await expect(body(page).locator('tr').first()).toContainText('Ad')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('tr td:first-child')).toHaveText(['On', 'İki', 'Bir'])
  await page.getByRole('button', { name: 'Tablo özellikleri', exact: true }).click()
  await page.getByRole('combobox', { name: 'Tablo görünümü' }).selectOption('striped')
  await page.getByRole('button', { name: 'Tabloyu güncelle', exact: true }).click()
  await expect(body(page).locator('table')).toHaveAttribute('data-studio-table', 'striped')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await page.getByRole('button', { name: 'Tablo özellikleri', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Tablo görünümü' })).toHaveValue('plain')
})

test('table cells merge without losing content, split and disable sorting while merged', async ({
  page,
}) => {
  await start(
    page,
    '<table><tbody><tr><td>Sol</td><td>Sağ</td><td>Son</td></tr><tr><td>A</td><td>B</td><td>C</td></tr></tbody></table>',
  )
  await body(page).locator('td').first().click()
  await menu(page, 'Tablo', 'Sağdaki hücreyle birleştir')
  await expect(body(page).locator('td').first()).toHaveAttribute('colspan', '2')
  await expect(body(page).locator('td').first()).toHaveText('SolSağ')
  await page.locator('.native-menubar').getByRole('button', { name: 'Tablo', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Seçili sütuna göre A → Z' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'Hücreyi ayır', exact: true }).click()
  await expect(body(page).locator('tr').first().locator('td')).toHaveCount(3)
  await expect(body(page).locator('[colspan]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('td').first()).toHaveAttribute('colspan', '2')
})

test('accessibility checker repairs image and table metadata with undo and reports heading gaps', async ({
  page,
}) => {
  await start(
    page,
    '<h1>Başlık</h1><h3>Atlanan düzey</h3><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="></p><table><tr><td>Başlık</td></tr><tr><td>Veri</td></tr></table>',
  )
  await page.getByRole('button', { name: 'İçerik denetimi', exact: true }).click()
  await expect(page.locator('.check-card')).toHaveCount(3)
  await page
    .getByRole('textbox', { name: 'Görsel açıklaması', exact: true })
    .fill('Açıklayıcı metin')
  await page.getByRole('button', { name: 'Düzeltmeyi uygula', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('alt', 'Açıklayıcı metin')
  await page.getByRole('button', { name: 'İlk satırı başlık yap', exact: true }).click()
  await expect(body(page).locator('th')).toHaveAttribute('scope', 'col')
  await expect(page.locator('.check-card')).toHaveCount(1)
  await expect(page.locator('.check-card')).toContainText('Başlık düzeyi atlanmış')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('th')).toHaveCount(0)
})

test('format painter and Turkish case changes preserve selected text and undo', async ({
  page,
}) => {
  await start(
    page,
    '<p><span style="color:rgb(200,0,0);font-size:24px;font-weight:700">Kaynak</span></p><p>istanbul ılık</p>',
  )
  await select(page, 'span')
  await menu(page, 'Biçim', 'Biçimi kopyala')
  await select(page, 'p:last-child')
  await page.getByRole('button', { name: 'Biçimi uygula', exact: true }).click()
  await expect(body(page).locator('p:last-child span')).toHaveCSS('color', 'rgb(200, 0, 0)')
  await expect(body(page).locator('p:last-child span')).toHaveCSS('font-size', '24px')
  await select(page, 'p:last-child')
  await menu(page, 'Biçim', 'BÜYÜK HARFE ÇEVİR')
  await expect(body(page).locator('p:last-child')).toHaveText('İSTANBUL ILIK')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('p:last-child')).toHaveText('istanbul ılık')
})

test('contents links point at unique headings and refresh without adding another contents block', async ({
  page,
}) => {
  await start(
    page,
    '<p>Giriş</p><h1 id="duplicate">Başlık</h1><h2 id="duplicate">Birinci bölüm</h2><h2>İkinci bölüm</h2>',
  )
  await body(page).locator('p').click()
  await menu(page, 'Ekle', 'İçindekiler ekle / güncelle')
  await expect(body(page).locator('[data-studio-toc]')).toHaveCount(1)
  await expect(body(page).locator('[data-studio-toc] a')).toHaveCount(3)
  const linksWork = await body(page).evaluate((root) =>
    [...root.querySelectorAll('[data-studio-toc] a')].every(
      (a) => root.ownerDocument.getElementById(a.hash.slice(1))?.textContent === a.textContent,
    ),
  )
  expect(linksWork).toBeTruthy()
  await body(page).locator('h2').last().fill('Güncellenmiş bölüm')
  await menu(page, 'Ekle', 'İçindekiler ekle / güncelle')
  await expect(body(page).locator('[data-studio-toc]')).toHaveCount(1)
  await expect(body(page).locator('[data-studio-toc] a').last()).toHaveText('Güncellenmiş bölüm')
})

test('accessibility naming keeps linked images and malformed review data cannot break the panel', async ({
  page,
}) => {
  await start(
    page,
    '<p><a href="https://example.com"><img alt="" width="30" height="30" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="></a><span data-studio-thread="null">Metin</span></p>',
  )
  await page.getByRole('button', { name: 'İçerik denetimi', exact: true }).click()
  await page.getByRole('textbox', { name: 'Bağlantı metni', exact: true }).fill('Ürün detayları')
  await page.getByRole('button', { name: 'Düzeltmeyi uygula', exact: true }).click()
  await expect(body(page).locator('a img')).toHaveCount(1)
  await expect(body(page).locator('a')).toHaveAttribute('aria-label', 'Ürün detayları')
  await page
    .locator('.content-tool-strip')
    .getByRole('button', { name: 'Yorumlar', exact: true })
    .click()
  await expect(page.locator('.comment-card')).toHaveCount(0)
})

test('advanced commands protect ragged tables and row-spanning cells', async ({ page }) => {
  await start(
    page,
    '<table><tr><td rowspan="2">Birleşik</td><td>A</td></tr><tr><td>B</td></tr></table>',
  )
  await body(page).locator('td').first().click()
  await page.locator('.native-menubar').getByRole('button', { name: 'Tablo', exact: true }).click()
  await expect(
    page.getByRole('menuitem', { name: 'Sağdaki hücreyle birleştir', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('menuitem', { name: 'Seçili sütuna göre A → Z', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Sütun ekle', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(body(page).locator('td')).toHaveCount(3)
})

test('mobile review and template library remain usable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page, '<p>İncelenecek metin</p>')
  await select(page, 'p')
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Yeni yorum' })).toBeVisible()
  await page.getByRole('button', { name: 'İnceleme panelini kapat' }).click()
  await page.getByRole('button', { name: 'Şablonlar', exact: true }).click()
  await page.getByRole('button', { name: 'Şablonu ekle', exact: true }).click()
  await expect(body(page).locator('h1')).toHaveText('Yeni proje')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
})
