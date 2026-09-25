import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const menu = (page) => page.getByRole('menu', { name: 'Sağ tık menüsü', exact: true })
async function content(page, html) {
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function start(page, html) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  if (html) await content(page, html)
}
async function imageDocument(page) {
  await start(page)
  const src = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 240
    const ctx = c.getContext('2d')
    for (const [color, x, y] of [
      ['#ff0000', 0, 0],
      ['#00ff00', 200, 0],
      ['#0000ff', 0, 120],
      ['#ffff00', 200, 120],
    ]) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, 200, 120)
    }
    return c.toDataURL('image/png')
  })
  await content(
    page,
    `<p><img src="${src}" alt="Renk bölgeleri" style="width:300px;height:auto"></p><p>Son metin</p>`,
  )
  return src
}
async function openImageEditor(page) {
  await body(page).locator('img').dblclick()
  await expect(page.getByRole('button', { name: 'Görseli uygula', exact: true })).toBeEnabled()
}
async function pixel(page, x = 10, y = 10) {
  return body(page)
    .locator('img')
    .evaluate(
      async (img, { x, y }) => {
        await img.decode()
        const c = img.ownerDocument.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        return {
          width: c.width,
          height: c.height,
          color: [...c.getContext('2d').getImageData(x, y, 1, 1).data],
        }
      },
      { x, y },
    )
}

test('WebP output uses selected quality and preserves dimensions', async ({ page }) => {
  await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'WebP', exact: true }).click()
  await page.getByRole('slider', { name: 'Kalite', exact: true }).fill('65')
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/)
  expect((await pixel(page)).width).toBe(400)
})

test('context menu formats the selection, supports keyboard opening and dismisses in document', async ({
  page,
}) => {
  await start(page, '<p>Seçilen metin</p><p>Başka paragraf</p>')
  await body(page).focus()
  await body(page).locator('p').first().selectText()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  await menu(page).getByRole('menuitem', { name: 'Kalın', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Seçilen metin')
  await body(page).locator('p').last().click({ button: 'right' })
  await expect(menu(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await body(page).locator('p').last().click({ button: 'right' })
  await body(page).locator('p').first().click()
  await expect(menu(page)).toHaveCount(0)
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  await expect(menu(page).getByRole('menuitem', { name: 'Kalın', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
})

test('right click targets the actual table cell, link and image', async ({ page }) => {
  await start(
    page,
    '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p><a href="https://example.com">Bağlantı</a></p>',
  )
  await body(page).locator('td').nth(3).click({ button: 'right' })
  await menu(page).getByRole('menuitem', { name: 'Üstüne satır ekle' }).click()
  await expect(body(page).locator('tr')).toHaveCount(3)
  await expect(body(page).locator('tr').last()).toHaveText('CD')
  await body(page).locator('td').first().click({ button: 'right' })
  await menu(page).getByRole('menuitem', { name: 'Tablo özellikleri' }).click()
  await expect(page.locator('.table-properties-form')).toBeVisible()
  await page.keyboard.press('Escape')
  await body(page).locator('a').click({ button: 'right' })
  await menu(page).getByRole('menuitem', { name: 'Bağlantıyı düzenle' }).click()
  await expect(page.getByRole('textbox', { name: 'Bağlantı adresi' })).toHaveValue(
    'https://example.com',
  )
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await imageDocument(page)
  await body(page).locator('img').click({ button: 'right' })
  await menu(page).getByRole('menuitem', { name: 'Resmi düzenle' }).click()
  await expect(page.getByRole('button', { name: 'Görseli uygula', exact: true })).toBeEnabled()
})

test('denied clipboard cut keeps content and provides a keyboard fallback', async ({ page }) => {
  await start(page, '<p>Korunacak içerik</p>')
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async () => {
          throw new Error('denied')
        },
        writeText: async () => {
          throw new Error('denied')
        },
      },
    }),
  )
  await body(page).focus()
  await body(page).locator('p').selectText()
  await page.keyboard.press('Shift+F10')
  await menu(page).getByRole('menuitem', { name: 'Kes', exact: true }).click()
  await expect(body(page)).toHaveText('Korunacak içerik')
  await expect(
    page.getByRole('status').filter({ hasText: 'Tarayıcı panoya erişemedi' }),
  ).toBeVisible()
})

test('crop exports correct pixels, keeps alt text, saves a media copy and supports undo and reload', async ({
  page,
}, testInfo) => {
  const original = await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Kırp', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Kırpma genişlik', exact: true }).fill('200')
  await page.getByRole('spinbutton', { name: 'Kırpma yükseklik', exact: true }).fill('120')
  await page.getByRole('spinbutton', { name: 'Çıktı genişliği', exact: true }).fill('100')
  await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('image-editor.png') })
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await pixel(page)).toEqual({ width: 100, height: 60, color: [255, 0, 0, 255] })
  await expect(body(page).locator('img')).toHaveAttribute('alt', 'Renk bölgeleri')
  const edited = await body(page).locator('img').getAttribute('src')
  expect(edited).not.toBe(original)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('src', original)
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('src', edited)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('img')).toHaveAttribute('src', edited)
  await page.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(1)
})

test('rotation, flip and color adjustments produce real pixels, not just CSS', async ({ page }) => {
  await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Sağa döndür', exact: true }).click()
  await page.getByRole('button', { name: 'Yatay çevir', exact: true }).click()
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await pixel(page)).toEqual({ width: 240, height: 400, color: [255, 0, 0, 255] })
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Siyah beyaz', exact: true }).click()
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const gray = await pixel(page)
  expect(gray.color[0]).toBe(gray.color[1])
  expect(gray.color[1]).toBe(gray.color[2])
  expect(gray.color[0]).toBeGreaterThan(0)
})

test('cancel and reset leave the original intact; failed storage keeps edits open', async ({
  page,
}) => {
  const src = await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Sağa döndür', exact: true }).click()
  await page.getByRole('button', { name: 'Tüm ayarları sıfırla', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Çıktı genişliği', exact: true })).toHaveValue(
    '400',
  )
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute('src', src)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Siyah beyaz', exact: true }).click()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'media') throw new Error('full')
      return put.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Depolama')
  await expect(body(page).locator('img')).toHaveAttribute('src', src)
  await expect(page.getByRole('button', { name: 'Görseli uygula', exact: true })).toBeEnabled()
})

test('free image resizing uses side handles and is a single undo step', async ({ page }) => {
  await imageDocument(page)
  await body(page).locator('img').click()
  await expect(page.locator('.image-resize-handle')).toHaveCount(8)
  await page.getByRole('button', { name: 'Oranı koru', exact: true }).click()
  const handle = page.getByRole('button', { name: 'Görseli boyutlandır: Sağ kenar', exact: true })
  const box = await handle.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(body(page).locator('img')).toHaveCSS('width', '360px')
  await expect(body(page).locator('img')).toHaveCSS('height', '180px')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('img')).toHaveCSS('width', '300px')
})

test('mobile image editor supports crop drag, precise keyboard movement and JPEG output', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('button', { name: 'Kırp', exact: true }).click()
  await page.getByRole('button', { name: '1:1', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('image-editor-mobile.png') })
  const crop = page.locator('.image-crop-box')
  await crop.focus()
  const before = Number(
    await page.getByRole('spinbutton', { name: 'Kırpma sol', exact: true }).inputValue(),
  )
  await page.keyboard.press('Shift+ArrowRight')
  await expect(page.getByRole('spinbutton', { name: 'Kırpma sol', exact: true })).toHaveValue(
    String(before + 10),
  )
  await page.getByRole('button', { name: 'Yeni alan çiz', exact: true }).click()
  const rect = await page.locator('.image-edit-stage').boundingBox()
  await page.mouse.move(rect.x + 30, rect.y + 20)
  await page.mouse.down()
  await page.mouse.move(rect.x + 100, rect.y + 90, { steps: 8 })
  await page.mouse.up()
  expect(
    Number(
      await page.getByRole('spinbutton', { name: 'Kırpma genişlik', exact: true }).inputValue(),
    ),
  ).toBeLessThan(240)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'JPEG', exact: true }).click()
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(body(page).locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
})

test('context paste sanitizes clipboard HTML and is undoable', async ({ page }) => {
  await start(page, '<p>Başlangıç</p>')
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [
          {
            types: ['text/html'],
            getType: async () =>
              new Blob(['<p><strong>Panodan</strong><script>window.pasteAttack=1</script></p>'], {
                type: 'text/html',
              }),
          },
        ],
      },
    }),
  )
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+F10')
  await menu(page).getByRole('menuitem', { name: 'Yapıştır', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Panodan')
  await expect(body(page).locator('script')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Başlangıç')
})

test('remote image without cross-origin permission is readable but editing fails safely', async ({
  page,
}) => {
  const src = await imageDocument(page)
  await page.route('https://images.example.test/picture.png', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': 'https://different-origin.example' },
      body: Buffer.from(src.split(',')[1], 'base64'),
    }),
  )
  await content(
    page,
    '<p><img src="https://images.example.test/picture.png" alt="Harici görsel" style="width:300px"></p>',
  )
  await expect
    .poll(() =>
      body(page)
        .locator('img')
        .evaluate((img) => img.naturalWidth),
    )
    .toBe(400)
  await body(page).locator('img').dblclick()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'medya kütüphanesine yükleyin',
  )
  await expect(page.getByRole('button', { name: 'Görseli uygula', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await expect(body(page).locator('img')).toHaveAttribute(
    'src',
    'https://images.example.test/picture.png',
  )
})

test('output size limits reject oversized canvases without replacing the image', async ({
  page,
}) => {
  const src = await imageDocument(page)
  await openImageEditor(page)
  await page.getByRole('spinbutton', { name: 'Çıktı genişliği', exact: true }).fill('9000')
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('8192')
  await expect(body(page).locator('img')).toHaveAttribute('src', src)
  await page.getByRole('spinbutton', { name: 'Çıktı genişliği', exact: true }).fill('80')
  await page.getByRole('button', { name: 'Görseli uygula', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await pixel(page)).width).toBe(80)
})
