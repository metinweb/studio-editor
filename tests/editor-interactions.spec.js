import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const nav = (page, name) =>
  page.locator('.native-menubar').getByRole('button', { name, exact: true })
const colorBar = (page, highlight = false) =>
  page
    .getByRole('button', { name: highlight ? 'Vurgu rengi' : 'Metin rengi', exact: true })
    .locator('span')
    .first()
const tableHtml =
  '<h2>Tablo</h2><p>Önceki metin</p><table style="width:100%"><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p>Sonraki metin</p>'
async function start(page, html = tableHtml) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}

test('menubar hover switches only after opening and reanchors each menu', async ({ page }) => {
  await start(page)
  await nav(page, 'Ekle').hover()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await nav(page, 'Dosya').click()
  await nav(page, 'Ekle').hover()
  await expect(nav(page, 'Ekle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menuitem', { name: 'Kod bloğu ekle', exact: true })).toBeVisible()
  await nav(page, 'Biçim').hover()
  await expect(page.getByRole('menuitem', { name: 'Kalın', exact: true })).toBeVisible()
  const anchor = await nav(page, 'Biçim').boundingBox()
  const popup = await page.locator('.editor-popover').boundingBox()
  expect(Math.abs(popup.x - anchor.x)).toBeLessThan(3)
  await page.keyboard.press('Escape')
  await expect(nav(page, 'Biçim')).toBeFocused()
  await nav(page, 'Tablo').hover()
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('left and right keys traverse open menus while keeping the document selection', async ({
  page,
}) => {
  await start(page, '<p>Seçili metin</p>')
  await body(page).locator('p').selectText()
  await nav(page, 'Ekle').click()
  await page.keyboard.press('ArrowRight')
  await expect(nav(page, 'Biçim')).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('menuitem', { name: 'Kalın', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Seçili metin')
  await nav(page, 'Biçim').click()
  await page.keyboard.press('ArrowLeft')
  await expect(nav(page, 'Ekle')).toHaveAttribute('aria-expanded', 'true')
  await body(page)
    .locator('p')
    .click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('typography menus preview fonts, apply to selection and reflect caret and undo', async ({
  page,
}) => {
  await start(
    page,
    '<p><span style="font-family:Arial,sans-serif;font-size:24px">Arial metin</span></p><p>Varsayılan metin</p>',
  )
  await body(page).locator('span').selectText()
  const font = page.getByRole('button', { name: 'Yazı tipi', exact: true })
  await expect(font).toContainText('Arial')
  await expect(page.locator('.native-toolbar select')).toHaveCount(0)
  await font.click()
  await expect(page.getByRole('menuitemradio', { name: 'Arial', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('menuitemradio', { name: 'Georgia', exact: true })).toHaveCSS(
    'font-family',
    'Georgia, serif',
  )
  await page.keyboard.press('v')
  await expect(page.getByRole('menuitemradio', { name: 'Verdana', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(font).toContainText('Verdana')
  await expect(body(page).locator('span').last()).toHaveCSS('font-family', 'Verdana, sans-serif')
  await page.getByRole('button', { name: 'Yazı boyutu', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '32 px', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yazı boyutu', exact: true })).toContainText(
    '32 px',
  )
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yazı boyutu', exact: true })).toContainText(
    '24 px',
  )
  await body(page).locator('p').last().click()
  await expect(font).toContainText('Arial')
})

test('table gets an outline and floating shortcuts for before and after insertions and deletion', async ({
  page,
}) => {
  await start(page)
  await body(page).locator('td').first().click()
  const bar = page.getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
  await expect(bar).toBeVisible()
  await expect(page.locator('.table-selection-frame')).toHaveCSS('outline-width', '3px')
  const tableBox = await body(page).locator('table').boundingBox()
  const barBox = await bar.boundingBox()
  expect(barBox.y + barBox.height).toBeLessThan(tableBox.y)
  await bar.getByRole('button', { name: 'Üstüne satır ekle', exact: true }).click()
  await expect(body(page).locator('tr')).toHaveCount(3)
  await expect(body(page).locator('tr').nth(1)).toContainText('A')
  await page.keyboard.type('Yeni')
  await expect(body(page).locator('td').first()).toHaveText('Yeni')
  await bar.getByRole('button', { name: 'Soluna sütun ekle', exact: true }).click()
  await expect(body(page).locator('tr').first().locator('td')).toHaveCount(3)
  await expect(body(page).locator('tr').first().locator('td').nth(1)).toHaveText('Yeni')
  await bar.getByRole('button', { name: 'Sütunu sil', exact: true }).click()
  await expect(body(page).locator('tr').first().locator('td')).toHaveCount(2)
  await bar.getByRole('button', { name: 'Tabloyu sil', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await expect(bar).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(1)
})

test('table properties preserve cell contents and overlays never enter saved HTML', async ({
  page,
}) => {
  await start(page)
  await body(page).locator('td').first().click()
  await page.getByRole('button', { name: 'Tablo özellikleri', exact: true }).click()
  await page.getByRole('textbox', { name: 'Tablo açıklaması' }).fill('İçerik takvimi')
  await page.getByRole('textbox', { name: 'Tablo genişliği' }).fill('80%')
  await page.getByRole('combobox', { name: 'Tablo görünümü' }).selectOption('striped')
  await page.getByRole('button', { name: 'Tabloyu güncelle' }).click()
  await expect(body(page).locator('caption')).toHaveText('İçerik takvimi')
  await expect(body(page).locator('td')).toHaveText(['A', 'B', 'C', 'D'])
  await expect(body(page).locator('table')).toHaveAttribute('style', /width: 80%/)
  await expect(body(page).locator('button,.table-selection-frame')).toHaveCount(0)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('caption')).toHaveText('İçerik takvimi')
  await expect(body(page).locator('table')).toHaveAttribute('data-studio-table', 'striped')
})

test('table overlay follows scrolling, width resize is one undo step and Escape cancels', async ({
  page,
}) => {
  await start(page)
  await body(page).locator('td').first().click()
  const original = await body(page).locator('table').boundingBox()
  const handle = page.getByRole('button', {
    name: 'Tablo genişliğini boyutlandır: se',
    exact: true,
  })
  async function drag(dx) {
    const rect = await handle.boundingBox()
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await page.mouse.down()
    await page.mouse.move(rect.x + rect.width / 2 + dx, rect.y + rect.height / 2, { steps: 6 })
  }
  await drag(-120)
  await page.mouse.up()
  await expect
    .poll(async () => Math.round((await body(page).locator('table').boundingBox()).width))
    .toBe(Math.round(original.width) - 120)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect
    .poll(async () => Math.round((await body(page).locator('table').boundingBox()).width))
    .toBe(Math.round(original.width))
  await drag(-80)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(body(page).locator('table')).toHaveAttribute('style', 'width:100%')
  await body(page).evaluate((root) => {
    root.style.minHeight = '2000px'
    root.ownerDocument.defaultView.scrollTo(0, 60)
  })
  await expect
    .poll(async () => {
      const t = await body(page).locator('table').boundingBox()
      const outline = await page.locator('.table-selection-frame').boundingBox()
      return Math.abs(t.y - outline.y) + Math.abs(t.width - outline.width)
    })
    .toBeLessThan(2)
  await body(page).locator('p').last().click()
  await expect(page.locator('.table-selection-frame')).toHaveCount(0)
})

test('mobile floating table tools and typography menus fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page)
  await body(page).locator('td').first().click()
  const rect = await page.locator('.table-quick-toolbar').boundingBox()
  expect(rect.x).toBeGreaterThanOrEqual(0)
  expect(rect.x + rect.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Yazı tipi', exact: true }).click()
  const popup = await page.locator('.editor-popover').boundingBox()
  expect(popup.x + popup.width).toBeLessThanOrEqual(390)
  await page.getByRole('menuitemradio', { name: 'Verdana', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yazı tipi', exact: true })).toContainText(
    'Verdana',
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
})

test('color palettes preserve selection through preset, custom and reset actions', async ({
  page,
}) => {
  await start(page, '<p>Renkli metin</p>')
  const selectedText = () =>
    body(page).evaluate((root) => root.ownerDocument.getSelection().toString())
  await body(page).locator('p').selectText()
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '#2563eb', exact: true }).click()
  await expect(body(page).locator('span').last()).toHaveCSS('color', 'rgb(37, 99, 235)')
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(37, 99, 235)')
  expect(await selectedText()).toBe('Renkli metin')
  await page.getByRole('button', { name: 'Vurgu rengi', exact: true }).click()
  await page.getByRole('textbox', { name: 'Hex renk kodu' }).fill('#facc15')
  await page.getByRole('button', { name: 'Özel rengi uygula' }).click()
  await expect(body(page).locator('span').last()).toHaveCSS('background-color', 'rgb(250, 204, 21)')
  await expect(colorBar(page, true)).toHaveCSS('border-bottom-color', 'rgb(250, 204, 21)')
  expect(await selectedText()).toBe('Renkli metin')
  await page.getByRole('button', { name: 'Vurgu rengi', exact: true }).click()
  await page.getByRole('button', { name: 'Vurguyu kaldır' }).click()
  await expect(body(page).locator('span').last()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(colorBar(page, true)).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('span').last()).toHaveCSS('background-color', 'rgb(250, 204, 21)')
  await expect(colorBar(page, true)).toHaveCSS('border-bottom-color', 'rgb(250, 204, 21)')
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  await page.getByRole('button', { name: 'Varsayılan metin rengi' }).click()
  await expect(body(page).locator('span').last()).toHaveCSS('color', 'rgb(37, 51, 67)')
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(37, 51, 67)')
})

test('color indicators follow caret, nested highlights and keyboard navigation instead of the last chosen color', async ({
  page,
}) => {
  await start(
    page,
    '<p><span style="color:#dc2626;background-color:#facc15"><strong>Kırmızı metin</strong></span></p><p style="color:#2563eb"><em>Mavi metin</em></p><p>Normal metin</p>',
  )
  await body(page).locator('strong').click()
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(220, 38, 38)')
  await expect(colorBar(page, true)).toHaveCSS('border-bottom-color', 'rgb(250, 204, 21)')
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  await expect(page.getByRole('menuitemradio', { name: '#dc2626', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('textbox', { name: 'Hex renk kodu' })).toHaveValue('#dc2626')
  await page.keyboard.press('Escape')
  await body(page).locator('em').click()
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(37, 99, 235)')
  await expect(colorBar(page, true)).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
  await body(page).press('ArrowDown')
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(37, 51, 67)')
  await body(page).press('ArrowUp')
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(37, 99, 235)')
  await body(page).locator('strong').selectText()
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(220, 38, 38)')
})

test('pending typing color is reflected immediately and moving the caret restores the destination color', async ({
  page,
}) => {
  await start(page, '<p>Yeni renk</p><p style="color:#dc2626">Mevcut renk</p>')
  await body(page).locator('p').first().click()
  await body(page).press('End')
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '#16a34a', exact: true }).click()
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(22, 163, 74)')
  await page.keyboard.type(' yesil')
  await expect(body(page).locator('span').last()).toHaveCSS('color', 'rgb(22, 163, 74)')
  await body(page).locator('p').last().click()
  await expect(colorBar(page)).toHaveCSS('border-bottom-color', 'rgb(220, 38, 38)')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(colorBar(page)).toHaveCSS(
    'border-bottom-color',
    await body(page).evaluate((root) => {
      const selection = root.ownerDocument.getSelection()
      const node = selection.anchorNode
      return root.ownerDocument.defaultView.getComputedStyle(
        node.nodeType === 3 ? node.parentElement : node,
      ).color
    }),
  )
})

test('mobile expanded toolbar exposes tools and color palette supports keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page, '<p>Mobil düzenleme</p>')
  await body(page).locator('p').selectText()
  await page.getByRole('button', { name: 'Tüm araçları göster' }).click()
  await page.getByRole('button', { name: 'Kalın', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Mobil düzenleme')
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: '#991b1b', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(body(page).locator('span').last()).toHaveCSS('color', 'rgb(153, 27, 27)')
  await page.getByRole('button', { name: 'Metin rengi', exact: true }).click()
  const rect = await page.locator('.color-palette').boundingBox()
  expect(rect.x).toBeGreaterThanOrEqual(0)
  expect(rect.x + rect.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Metin rengi', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Araçları daralt' }).click()
  await expect(page.locator('.native-toolbar')).not.toHaveClass(/toolbar-expanded/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
