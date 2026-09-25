import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const corner = (page) =>
  page.getByRole('button', { name: 'Görseli boyutlandır: Sağ alt köşe', exact: true })
async function start(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function imageData(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 360
    const context = canvas.getContext('2d')
    context.fillStyle = '#a997cf'
    context.fillRect(0, 0, 600, 360)
    return canvas.toDataURL('image/png')
  })
}
async function withImage(page, prefix = '<h2>Görsel düzenleme</h2>') {
  await page.goto('/')
  const data = await imageData(page)
  await start(
    page,
    `${prefix}<p><img src="${data}" alt="Test görseli" style="width:300px;height:auto"></p><p>Son paragraf</p>`,
  )
  const image = body(page).locator('img')
  await image.click()
  await expect(corner(page)).toBeVisible()
  return image
}
async function drag(page, dx, dy = 0) {
  const rect = await corner(page).boundingBox()
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width / 2 + dx, rect.y + rect.height / 2 + dy, { steps: 8 })
}

test('table grid previews dimensions, inserts at the selection and is undoable', async ({
  page,
}) => {
  await start(page, '<p>Tablo buraya</p>')
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Tablo ekle', exact: true }).click()
  await page.getByRole('button', { name: '4 sütun, 3 satır', exact: true }).hover()
  await expect(page.locator('.table-picker-title')).toContainText('4 × 3')
  await expect(page.locator('.table-grid .selected')).toHaveCount(12)
  await page.getByRole('button', { name: '4 sütun, 3 satır', exact: true }).click()
  await expect(body(page).locator('tr')).toHaveCount(3)
  await expect(body(page).locator('th[scope=col]')).toHaveCount(4)
  await page.keyboard.type('Baslik')
  await expect(body(page).locator('th').first()).toHaveText('Baslik')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await expect(body(page)).toContainText('Tablo buraya')
})

test('table grid supports keyboard selection, header toggle and Escape focus return', async ({
  page,
}) => {
  await start(page, '<p>İçerik</p>')
  const button = page.getByRole('button', { name: 'Tablo ekle', exact: true })
  await button.click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.table-picker')).toHaveCount(0)
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('checkbox', { name: 'İlk satır başlık olsun' }).uncheck()
  await page.getByRole('button', { name: '1 sütun, 1 satır', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(body(page).locator('tr')).toHaveCount(2)
  await expect(body(page).locator('td')).toHaveCount(4)
  await expect(body(page).locator('th')).toHaveCount(0)
})

test('image corner drag preserves ratio, commits one undo step and persists clean HTML', async ({
  page,
}) => {
  const image = await withImage(page)
  await drag(page, 120, 72)
  await page.mouse.up()
  await expect(image).toHaveCSS('width', '420px')
  await expect(image).toHaveCSS('height', '252px')
  await expect(page.locator('.image-dimensions')).toHaveText('420 × 252 px')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(image).toHaveCSS('width', '300px')
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(image).toHaveCSS('width', '420px')
  await expect(body(page).locator('.image-selection, button')).toHaveCount(0)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('img')).toHaveCSS('width', '420px')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dışa aktar', exact: true }).click()
  const stream = await (await download).createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const html = Buffer.concat(chunks).toString('utf8')
  expect(html).toContain('width: 420px')
  expect(html).not.toMatch(/image-selection|image-resize-handle|image-dimensions/)
})

test('Escape cancels an image drag and keyboard resize uses 1 or 10 pixel steps', async ({
  page,
}) => {
  const image = await withImage(page)
  await drag(page, 90, 54)
  await expect(image).toHaveCSS('width', '390px')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(image).toHaveCSS('width', '300px')
  await corner(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveCSS('width', '301px')
  await page.keyboard.press('Shift+ArrowLeft')
  await expect(image).toHaveCSS('width', '291px')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(image).toHaveCSS('width', '301px')
})

test('image selection tracks iframe scrolling, alignment and fullscreen layout', async ({
  page,
}) => {
  const image = await withImage(page)
  await page.getByRole('button', { name: 'Görseli ortala', exact: true }).click()
  await expect(image).toHaveCSS('display', 'block')
  await page.getByRole('button', { name: '50%', exact: true }).click()
  const checkAlignment = async () => {
    await expect
      .poll(async () => {
        const imageBox = await image.boundingBox()
        const overlay = await page.locator('.image-selection').boundingBox()
        return (
          Math.abs(imageBox.x - overlay.x) +
          Math.abs(imageBox.y - overlay.y) +
          Math.abs(imageBox.width - overlay.width)
        )
      })
      .toBeLessThan(2)
  }
  await checkAlignment()
  await page.getByRole('button', { name: 'Tam ekran', exact: true }).click()
  await checkAlignment()
  await body(page).evaluate((root) => {
    root.style.minHeight = '1800px'
    root.ownerDocument.defaultView.scrollTo(0, 60)
  })
  await checkAlignment()
  await body(page).locator('p').last().click()
  await expect(page.locator('.image-selection')).toHaveCount(0)
})

test('uploaded image immediately has resize handles and selection clears on document switch', async ({
  page,
}) => {
  await start(page, '<p>Görsel</p>')
  const data = await imageData(page)
  await body(page).click()
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await page.locator('dialog input[type=file]').setInputFiles({
    name: 'example.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data.split(',')[1], 'base64'),
  })
  await page.getByRole('button', { name: 'Belgeye ekle', exact: true }).click()
  await expect(page.locator('.image-resize-handle')).toHaveCount(8)
  await page.getByRole('button', { name: '25%', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('style', /width: 25%/)
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await expect(page.locator('.image-selection')).toHaveCount(0)
  await expect(body(page).locator('img')).toHaveCount(0)
})

test('menus preserve formatting selection and dismiss on an iframe click', async ({ page }) => {
  await start(page, '<p>Menüden biçimlendir</p>')
  await body(page).locator('p').selectText()
  await page.getByRole('button', { name: 'Biçim', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Kalın', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Menüden biçimlendir')
  await page.getByRole('button', { name: 'Ekle', exact: true }).click()
  await body(page)
    .locator('p')
    .click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('narrow editor keeps table picker and image resizing inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const image = await withImage(page)
  await page.getByRole('button', { name: 'Tablo ekle', exact: true }).click()
  const popup = await page.locator('.editor-popover').boundingBox()
  expect(popup.x).toBeGreaterThanOrEqual(0)
  expect(popup.x + popup.width).toBeLessThanOrEqual(390)
  expect(popup.y + popup.height).toBeLessThanOrEqual(844)
  await page.keyboard.press('Escape')
  await image.click()
  await drag(page, -60, -36)
  await page.mouse.up()
  const imageBox = await image.boundingBox()
  expect(imageBox.width).toBeLessThan(250)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
})
