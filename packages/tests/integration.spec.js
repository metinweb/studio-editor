import { test, expect } from '@playwright/test'

test('installed package isolates page styles and independent editor content/history', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const frames = page.locator('.studio-editor-frame')
  await expect(frames).toHaveCount(2)
  const first = page.frameLocator('.studio-editor-frame').first().locator('body')
  const second = page.frameLocator('.studio-editor-frame').nth(1).locator('body')
  await expect(first).toHaveText('Birinci belge')
  await expect(second).toHaveText('İkinci belge')
  const firstEditor = page.locator('.studio-editor-embed').first()
  await firstEditor.getByRole('button', { name: 'Tam ekran', exact: true }).click()
  await expect(firstEditor.locator('.native-editor')).toHaveClass(/native-fullscreen/)
  const viewport = page.viewportSize()
  const fullscreenBox = await firstEditor.locator('.native-editor').boundingBox()
  expect(fullscreenBox.x).toBe(0)
  expect(fullscreenBox.y).toBe(0)
  expect(fullscreenBox.width).toBe(viewport.width)
  await page.keyboard.press('Escape')
  await expect(firstEditor.locator('.native-editor')).not.toHaveClass(/native-fullscreen/)
  await expect(page.locator('body')).toHaveCSS('margin-top', '27px')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 250, 230)')
  await expect(page.locator('#host-title')).toHaveCSS('font-size', '29px')
  await expect(page.locator('#host-button')).toHaveCSS('border-top-width', '3px')
  await expect(page.locator('.native-tool').first()).toHaveCSS('width', '36px')
  await expect(first).toHaveCSS('font-family', 'Arial, Helvetica, sans-serif')
  await page.getByRole('button', { name: 'API ile değiştir', exact: true }).click()
  await expect(first).toHaveText('API ile değişti')
  await expect(page.locator('#first-content')).toContainText('API ile değişti')
  await expect(second).toHaveText('İkinci belge')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(first).toHaveText('Birinci belge')
  await first.click()
  await page.keyboard.press('Control+s')
  await expect(page.locator('#saved-content')).toContainText('Birinci belge')
  await page.getByRole('button', { name: 'Editörü aç / kapat' }).click()
  await expect(frames).toHaveCount(1)
  await page.getByRole('button', { name: 'Editörü aç / kapat' }).click()
  await expect(frames).toHaveCount(2)
  await expect(first).toHaveText('Birinci belge')
  expect(errors).toEqual([])
})

test('installed lazy dialogs, sanitization, popovers and media work outside workspace', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const embed = page.locator('.studio-editor-embed').first()
  const first = page.frameLocator('.studio-editor-frame').first().locator('body')
  await expect(first).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill('<p>Paket içeriği</p><script>window.injected=1</script>')
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await expect(first).toHaveText('Paket içeriği')
  expect(await first.locator('script').count()).toBe(0)
  await first.locator('p').click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Sağ tık menüsü' })).toBeVisible()
  await expect(page.locator('.editor-popover')).toHaveCSS('position', 'fixed')
  await page.keyboard.press('Escape')
  await embed.getByRole('button', { name: 'Medya kütüphanesini aç', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Medya kütüphanesi', exact: true })).toBeVisible()
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 120
    const context = canvas.getContext('2d')
    context.fillStyle = '#2563eb'
    context.fillRect(0, 0, 240, 120)
    return canvas.toDataURL().split(',')[1]
  })
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    })
  await page.getByRole('button', { name: 'Belgeye ekle', exact: true }).click()
  await expect(first.locator('img')).toHaveCount(1)
  await first.locator('img').dblclick()
  await expect(page.getByRole('dialog', { name: 'Resim editörü', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Görseli uygula', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('vue-consumer.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('vue-consumer-mobile.png'), fullPage: true })
})
