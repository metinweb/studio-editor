import { test, expect } from '@playwright/test'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import { readFile } from 'node:fs/promises'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const button = (page, name) => page.getByRole('button', { name, exact: true })
const nav = (page, name) =>
  page.locator('.native-menubar').getByRole('button', { name, exact: true })
const item = (page, name) => page.getByRole('menuitem', { name, exact: true })
async function start(page, html = '<p>Birinci paragraf</p><p>İkinci paragraf</p>') {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await button(page, 'Kaynak kodu').click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await button(page, 'Değişiklikleri uygula').click()
}
async function footnote(page, index, text) {
  await body(page).locator(':scope > p').nth(index).selectText()
  await button(page, 'Dipnotlar').click()
  await page.getByRole('textbox', { name: 'Dipnot metni' }).fill(text)
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle', exact: true }).click()
}
function docxFixture(image) {
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const files = {
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/styles.xml': `<w:styles xmlns:w="${ns}"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
    'word/_rels/document.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="image1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="link1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>',
    'word/document.xml': `<w:document xmlns:w="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Imported report</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold content</w:t></w:r><w:hyperlink r:id="link1"><w:r><w:t>Unsafe link</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="image" descr="Test image"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="image1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:body></w:document>`,
  }
  return Buffer.from(
    zipSync({
      ...Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])),
      'word/media/image1.png': image,
    }),
  )
}

test('Word import previews and inserts headings, table, bold and image locally with sanitized links and undo', async ({
  page,
}) => {
  await start(page, '<p>Existing content</p>')
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 2
    return c.toDataURL().split(',')[1]
  })
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await button(page, 'Word dosyası içe aktar').click()
  await page.getByLabel('DOCX dosyası', { exact: true }).setInputFiles({
    name: 'report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docxFixture(Buffer.from(image, 'base64')),
  })
  const preview = page.frameLocator('iframe[title="Word içe aktarma önizlemesi"]')
  await expect(preview.locator('h1')).toHaveText('Imported report')
  await expect(preview.locator('td')).toHaveCount(2)
  await expect(preview.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(preview.locator('a[href^="javascript:"]')).toHaveCount(0)
  await button(page, 'İmlecin bulunduğu yere ekle').click()
  await expect(body(page)).toContainText('Existing content')
  await expect(body(page).locator('strong')).toHaveText('Bold content')
  await expect(body(page).locator('h1')).toHaveText('Imported report')
  await button(page, 'Geri al').click()
  await expect(body(page)).toHaveText('Existing content')
  await button(page, 'Word dosyası içe aktar').click()
  await page.getByLabel('DOCX dosyası', { exact: true }).setInputFiles({
    name: 'broken.docx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a zip'),
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(button(page, 'İmlecin bulunduğu yere ekle')).toBeDisabled()
})

test('footnotes renumber in reference order, edit, delete with references and survive undo/reload', async ({
  page,
}) => {
  await start(page)
  await footnote(page, 1, 'Second source')
  await footnote(page, 0, 'First source')
  await expect(body(page).locator('[data-studio-footnote-ref]')).toHaveText(['1', '2'])
  await expect(body(page).locator('[data-studio-footnote] p')).toHaveText([
    'First source',
    'Second source',
  ])
  await button(page, 'Dipnotlar').click()
  await page.locator('.document-field-items button').first().click()
  await page.getByRole('textbox', { name: 'Dipnot metni' }).fill('Updated source')
  await button(page, 'Güncelle').click()
  await expect(body(page).locator('[data-studio-footnote] p').first()).toHaveText('Updated source')
  await body(page).focus()
  await body(page).locator(':scope > p').first().selectText()
  await page.keyboard.press('Backspace')
  await expect(body(page).locator('[data-studio-footnote-ref]')).toHaveText(['1'])
  await expect(body(page).locator('[data-studio-footnote] p')).toHaveText(['Second source'])
  await button(page, 'Geri al').click()
  await expect(body(page).locator('[data-studio-footnote-ref]')).toHaveCount(2)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('[data-studio-footnote] p')).toHaveText([
    'Updated source',
    'Second source',
  ])
})

test('anchors appear in link picker and renaming updates internal links with undo', async ({
  page,
}) => {
  await start(page)
  await body(page).locator('p').last().selectText()
  await button(page, 'Bağlantı hedefleri').click()
  await page.getByRole('textbox', { name: 'Hedef adı' }).fill('details')
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle', exact: true }).click()
  await expect(body(page).locator('#details')).toHaveText('İkinci paragraf')
  await body(page).locator('p').first().selectText()
  await button(page, 'Bağlantı ekle').click()
  await page.getByRole('combobox', { name: 'Belge içindeki hedef' }).selectOption('#details')
  await button(page, 'Bağlantıyı uygula').click()
  await expect(body(page).locator('a')).toHaveAttribute('href', '#details')
  await button(page, 'Bağlantı hedefleri').click()
  await page.locator('.document-field-items button').click()
  await page.getByRole('textbox', { name: 'Hedef adı' }).fill('summary')
  await button(page, 'Güncelle').click()
  await expect(body(page).locator('a')).toHaveAttribute('href', '#summary')
  await expect(body(page).locator('#summary')).toBeVisible()
  await button(page, 'Geri al').click()
  await expect(body(page).locator('a')).toHaveAttribute('href', '#details')
})

test('merge fields survive save and fill as text with a single undo step', async ({ page }) => {
  await start(page, '<p>Dear </p>')
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await button(page, 'Şablon değişkenleri').click()
  await page.getByRole('textbox', { name: 'Değişken adı' }).fill('Customer.Name')
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle', exact: true }).click()
  await expect(body(page).locator('[data-studio-field]')).toHaveText('{{Customer.Name}}')
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('[data-studio-field]')).toHaveAttribute(
    'contenteditable',
    'false',
  )
  await button(page, 'Şablon değişkenleri').click()
  await page
    .getByRole('textbox', { name: 'Customer.Name', exact: true })
    .fill('<img src=x onerror=alert(1)>')
  await button(page, 'Değerleri belgeye uygula').click()
  await expect(body(page)).toContainText('<img src=x onerror=alert(1)>')
  await expect(body(page).locator('img')).toHaveCount(0)
  await button(page, 'Geri al').click()
  await expect(body(page).locator('[data-studio-field]')).toHaveCount(1)
})

test('DOCX exports real footnotes and internal bookmarks', async ({ page }) => {
  await start(
    page,
    '<p><a href="#details">Jump</a> text<sup data-studio-footnote-ref="fn-test"><a href="#fn-test">1</a></sup></p><h2 id="details" data-studio-anchor="true">Details</h2><div data-studio-footnotes="true"><hr><ol><li id="fn-test" data-studio-footnote="true"><p>Source reference</p></li></ol></div>',
  )
  await nav(page, 'Dosya').click()
  await item(page, 'Sayfa düzeni ve dışa aktarım').click()
  const downloading = page.waitForEvent('download')
  await button(page, 'DOCX indir').click()
  const entries = unzipSync(new Uint8Array(await readFile(await (await downloading).path())))
  expect(strFromU8(entries['word/footnotes.xml'])).toContain('Source reference')
  const xml = strFromU8(entries['word/document.xml'])
  expect(xml).toContain('w:footnoteReference w:id="1"')
  expect(xml).toContain('w:bookmarkStart')
  expect(xml).toContain('w:hyperlink w:anchor="studio_1"')
  expect(xml).not.toContain('Source reference')
})

test('quick toolbar formats selection; view guides and zoom never modify document HTML', async ({
  page,
}) => {
  await start(page, '<p>Alpha beta&nbsp;gamma</p>')
  await body(page).locator('p').selectText()
  await expect(page.getByRole('toolbar', { name: 'Seçili metin araçları' })).toBeVisible()
  await button(page, 'Hızlı Kalın').click()
  await expect(body(page).locator('strong')).toHaveText('Alpha beta gamma')
  const original = await body(page).innerHTML()
  await nav(page, 'Görünüm').click()
  await item(page, 'Blok sınırlarını göster').click()
  await expect(body(page).locator('p')).toHaveCSS('outline-style', 'dashed')
  await nav(page, 'Görünüm').click()
  await item(page, 'Görünmeyen karakterleri göster').click()
  await expect
    .poll(() =>
      body(page).evaluate(
        (root) =>
          root.ownerDocument.documentElement.querySelector(':scope > div[aria-hidden]')
            ?.textContent,
      ),
    )
    .toContain('°')
  await nav(page, 'Görünüm').click()
  await item(page, 'Yakınlaştırma').click()
  await item(page, '125%').click()
  expect(await body(page).innerHTML()).toBe(original)
  await button(page, 'Sözcük sayımı').click()
  await expect(page.locator('.document-metrics tr').nth(1)).toContainText('3')
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat', exact: true }).click()
  await button(page, 'Belge önizlemesi').click()
  await expect(
    page.frameLocator('iframe[title="Belge önizleme içeriği"]').locator('strong'),
  ).toHaveText('Alpha beta gamma')
})

test('paragraph indentation, custom font size, level six and typography are editable and undoable', async ({
  page,
}) => {
  await start(page, '<p>"Hello" ... (c)</p>')
  await body(page).locator('p').selectText()
  await button(page, 'Girintiyi artır').click()
  await expect(body(page).locator('p')).toHaveCSS('margin-inline-start', '24px')
  await button(page, 'Yazı boyutu').click()
  await page.getByRole('spinbutton', { name: 'Özel yazı boyutu' }).fill('23.5')
  await button(page, 'Yazı boyutunu uygula').click()
  await expect(body(page).locator('span')).toHaveCSS('font-size', '23.5px')
  await nav(page, 'Araçlar').click()
  await item(page, 'Tipografiyi iyileştir').click()
  await expect(body(page)).toHaveText('“Hello” … ©')
  await button(page, 'Geri al').click()
  await expect(body(page)).toHaveText('"Hello" ... (c)')
  await nav(page, 'Biçim').click()
  await item(page, 'Paragraf biçimleri').click()
  await item(page, 'Başlık 6').click()
  await expect(body(page).locator('h6')).toBeVisible()
})

test('desktop menus fly out on hover and mobile submenus stay in one panel', async ({ page }) => {
  await start(page)
  await nav(page, 'Biçim').click()
  await item(page, 'Satır aralığı').hover()
  await expect(page.getByRole('menu', { name: 'Satır aralığı', exact: true })).toBeVisible()
  await expect(page.getByRole('menu', { name: 'Biçim', exact: true })).toBeVisible()
  const box = await page.locator('.editor-popover').boundingBox()
  expect(box.x + box.width).toBeLessThanOrEqual(1440)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await nav(page, 'Biçim').click()
  await item(page, 'Satır aralığı').click()
  await expect(page.getByRole('menu', { name: 'Biçim', exact: true })).toBeHidden()
  await button(page, 'Önceki menü').click()
  await expect(item(page, 'Satır aralığı')).toBeVisible()
})
