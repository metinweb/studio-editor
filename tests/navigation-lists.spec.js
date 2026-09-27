import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const button = (page, name) => page.getByRole('button', { name, exact: true })
const menu = (page, name) =>
  page.locator('.native-menubar').getByRole('button', { name, exact: true })
async function start(page, html = '<p>Bir</p><p>İki</p><p>Üç</p>') {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await button(page, 'Kaynak kodu').click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await button(page, 'Değişiklikleri uygula').click()
}
async function style(page, kind, name) {
  await button(page, kind === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri').click()
  await page.getByRole('menuitemradio', { name, exact: true }).click()
}

test('list gallery creates, changes and removes styles with selection and undo intact', async ({
  page,
}) => {
  await start(page)
  await body(page).selectText()
  await style(page, 'ol', 'Küçük Roma rakamları')
  await expect(body(page).locator('ol')).toHaveCSS('list-style-type', 'lower-roman')
  await expect(body(page).locator('li')).toHaveCount(3)
  await style(page, 'ol', 'Büyük harfler')
  await expect(body(page).locator('ol')).toHaveCSS('list-style-type', 'upper-alpha')
  await button(page, 'Geri al').click()
  await expect(body(page).locator('ol')).toHaveCSS('list-style-type', 'lower-roman')
  await style(page, 'ul', 'Kare')
  await expect(body(page).locator('ul')).toHaveCSS('list-style-type', 'square')
  await button(page, 'Madde işareti stilleri').click()
  await page.getByRole('menuitem', { name: 'Listeyi kaldır', exact: true }).click()
  await expect(body(page).locator('ul,ol')).toHaveCount(0)
  await expect(body(page).locator('p')).toHaveCount(3)
})

test('numbering properties, nesting, partial removal and reload preserve list formatting', async ({
  page,
}) => {
  await start(
    page,
    '<ol start="5" style="list-style-type:upper-roman"><li>Bir</li><li>İki</li><li>Üç</li></ol>',
  )
  await body(page).locator('li').nth(1).click()
  await button(page, 'Girintiyi artır').click()
  await expect(body(page).locator('ol ol')).toHaveCSS('list-style-type', 'upper-roman')
  await button(page, 'Girintiyi azalt').click()
  await expect(body(page).locator('ol')).toHaveCount(1)
  await button(page, 'Numaralı liste').click()
  await expect(body(page).locator('ol').last()).toHaveAttribute('start', '7')
  await expect(body(page).locator('ol').last()).toHaveCSS('list-style-type', 'upper-roman')
  await body(page).locator('ol').last().locator('li').click()
  await button(page, 'Numaralandırma stilleri').click()
  await page.getByRole('menuitem', { name: 'Liste özellikleri', exact: true }).click()
  await page.getByLabel('Başlangıç numarası', { exact: true }).fill('0')
  await page.getByLabel('Ters numaralandırma', { exact: true }).check()
  await button(page, 'Uygula').click()
  await expect(body(page).locator('ol').last()).toHaveAttribute('start', '0')
  await expect(body(page).locator('ol').last()).toHaveAttribute('reversed', '')
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('ol').last()).toHaveAttribute('start', '0')
  await expect(body(page).locator('ol').last()).toHaveCSS('list-style-type', 'upper-roman')
})

test('submenus support keyboard back, line spacing, direction and selection preservation', async ({
  page,
}) => {
  await start(page, '<p>Seçili paragraf</p>')
  await body(page).locator('p').selectText()
  await menu(page, 'Biçim').click()
  await page.getByRole('menuitem', { name: 'Satır aralığı', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menu', { name: 'Satır aralığı', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'Satır aralığı', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: '2', exact: true }).click()
  await expect(body(page).locator('p')).toHaveCSS('line-height', '32px')
  await menu(page, 'Biçim').click()
  await page.getByRole('menuitem', { name: 'Metin yönü', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sağdan sola', exact: true }).click()
  await expect(body(page).locator('p')).toHaveAttribute('dir', 'rtl')
  await expect(body(page)).toHaveText('Seçili paragraf')
})

test('command search inserts symbols, dates, nonbreaking spaces, page breaks and opens anchored pickers', async ({
  page,
}) => {
  await start(page, '<p>Metin</p>')
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  const find = async (query, name) => {
    await menu(page, 'Komut bul').click()
    await page.getByRole('textbox', { name: 'Komut veya özellik ara' }).fill(query)
    await page.locator('.command-results').getByRole('button', { name, exact: false }).click()
  }
  await find('Özel karakterler', 'Özel karakterler ve emoji')
  await button(page, '©').click()
  await expect(body(page)).toContainText('Metin©')
  await find('ISO tarihi', 'ISO tarihi')
  await expect(body(page)).toContainText(/\d{4}-\d{2}-\d{2}/)
  await find('Bölünemez boşluk', 'Bölünemez boşluk')
  await expect.poll(() => body(page).textContent()).toMatch(/\u00a0/)
  await find('Sayfa sonu', 'Sayfa sonu')
  await expect(body(page).locator('[data-studio-page-break]')).toHaveCount(1)
  await find('Tablo ekle', 'Tablo ekle')
  await expect(page.locator('.table-picker')).toBeVisible()
})

test('DOCX retains custom list markers, reverse starts, spacing and page breaks', async ({
  page,
}) => {
  await start(
    page,
    '<p dir="rtl" style="line-height:2">Metin</p><ol start="5" reversed style="list-style-type:upper-roman"><li>Bir</li><li>İki</li></ol><ul style="list-style-type:square"><li>Kare</li></ul><hr data-studio-page-break="true"><p>Son</p>',
  )
  await menu(page, 'Dosya').click()
  await page.getByRole('menuitem', { name: 'Sayfa düzeni ve dışa aktarım', exact: true }).click()
  const download = page.waitForEvent('download')
  await button(page, 'DOCX indir').click()
  const entries = unzipSync(new Uint8Array(await readFile(await (await download).path())))
  const numbering = strFromU8(entries['word/numbering.xml'])
  const document = strFromU8(entries['word/document.xml'])
  expect(numbering).toContain('w:numFmt w:val="upperRoman"')
  expect(numbering).toContain('w:start w:val="5"')
  expect(numbering).toContain('w:start w:val="4"')
  expect(numbering).toContain('w:lvlText w:val="▪"')
  expect(document).toContain('w:line="480"')
  expect(document).toContain('<w:bidi/>')
  expect(document).toContain('w:br w:type="page"')
  const pageBreak = page
    .frameLocator('iframe[title="Yazdırma önizlemesi"]')
    .locator('[data-studio-page-break]')
  await expect(pageBreak).toHaveCSS('break-before', 'auto')
  await expect(pageBreak).toHaveCSS('break-after', 'page')
})

test('mobile list previews and submenu navigation fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page, '<p>Mobil liste</p>')
  await body(page).locator('p').click()
  await button(page, 'Numaralandırma stilleri').click()
  const gallery = await page.locator('.editor-popover').boundingBox()
  expect(gallery.x).toBeGreaterThanOrEqual(0)
  expect(gallery.x + gallery.width).toBeLessThanOrEqual(390)
  await page.getByRole('menuitemradio', { name: 'Başında sıfır', exact: true }).click()
  await expect(body(page).locator('ol')).toHaveCSS('list-style-type', 'decimal-leading-zero')
  await menu(page, 'Biçim').click()
  await page.getByRole('menuitem', { name: 'Satır aralığı', exact: true }).click()
  // Repositioning can expose another menubar item under a mouse pointer on small screens.
  // Mobile navigation must stay click-based even when the pointer is not a touchscreen.
  await menu(page, 'Ekle').hover()
  await expect(page.getByRole('menu', { name: 'Satır aralığı', exact: true })).toBeVisible()
  await button(page, 'Önceki menü').click()
  await expect(page.getByRole('menuitem', { name: 'Satır aralığı', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('task list converts to plain styled bullets without leftover checkbox controls', async ({
  page,
}) => {
  await start(
    page,
    '<ul data-studio-task-list="true"><li data-studio-checked="true">Görev</li></ul>',
  )
  await body(page).locator('li').click()
  await style(page, 'ul', 'Boş daire')
  await expect(body(page).locator('ul')).toHaveCSS('list-style-type', 'circle')
  await expect(body(page).locator('[data-studio-task-control], [data-studio-checked]')).toHaveCount(
    0,
  )
  await button(page, 'Geri al').click()
  await expect(body(page).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
})
