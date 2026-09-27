import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const button = (page, name) => page.getByRole('button', { name, exact: true })
async function start(page, html = '<p>Original</p><p>Second</p>') {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await button(page, 'Kaynak kodu').click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await button(page, 'Değişiklikleri uygula').click()
}
async function menu(page, name, item) {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
async function enableCorrections(page) {
  await menu(page, 'Araçlar', 'Otomatik düzeltme ve metin kısayolları')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await button(page, 'Ayarları uygula').click()
}
test('Markdown file import previews GFM safely, preserves tasks and supports undo', async ({
  page,
}) => {
  await start(page)
  await body(page).locator('p').first().click()
  await page.keyboard.press('End')
  await menu(page, 'Dosya', 'Markdown içe aktar')
  await page.getByLabel('Markdown dosyası', { exact: true }).setInputFiles({
    name: 'report.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '# Report\n\n**Bold** and ~~old~~\n\n- [x] Done\n- [ ] Next\n\n| Name | Value |\n| --- | --- |\n| Alpha | 42 |\n\n```js\nconst value = 1\n```\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))',
    ),
  })
  const preview = page.frameLocator('iframe[title="Markdown önizlemesi"]')
  await expect(preview.locator('h1')).toHaveText('Report')
  await expect(preview.locator('table')).toHaveCount(1)
  await expect(preview.locator('[data-studio-checked="true"]')).toContainText('Done')
  await expect(preview.locator('script,a[href^="javascript:"]')).toHaveCount(0)
  await button(page, 'İmlecin bulunduğu yere ekle').click()
  await expect(body(page).locator('code')).toHaveText('const value = 1\n')
  await expect(body(page).locator('[data-studio-task-control]')).toHaveCount(2)
  await button(page, 'Geri al').click()
  await expect(body(page)).toHaveText('OriginalSecond')
})
test('Markdown export downloads headings, tables, code and checklists', async ({ page }) => {
  await start(
    page,
    '<h2>Report</h2><p><strong>Bold</strong> <a href="https://example.com">Link</a></p><ul data-studio-task-list="true"><li data-studio-checked="true">Done</li></ul><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>42</td></tr></tbody></table><pre><code class="language-js">const n = 1</code></pre>',
  )
  await menu(page, 'Dosya', 'Markdown dışa aktar')
  const source = await page.getByRole('textbox', { name: 'Markdown metni' }).inputValue()
  expect(source).toContain('## Report')
  expect(source).toContain('**Bold**')
  expect(source).toMatch(/\[x\]\s*Done/)
  expect(source).toContain('| Name | Value |')
  expect(source).toContain('```js')
  const download = page.waitForEvent('download')
  await button(page, 'Markdown indir').click()
  expect(await readFile(await (await download).path(), 'utf8')).toBe(source)
})
test('autocorrect and multiline text shortcuts are literal, undoable and skip code', async ({
  page,
}) => {
  await start(page, '<p><br></p><pre><code>code </code></pre>')
  await menu(page, 'Araçlar', 'Otomatik düzeltme ve metin kısayolları')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await page.getByRole('textbox', { name: 'Kısayol', exact: true }).fill(';sig')
  await page
    .getByRole('textbox', { name: 'Yerine yazılacak metin' })
    .fill('Best regards\n<img src=x>')
  await button(page, 'Kural ekle').click()
  await button(page, 'Ayarları uygula').click()
  const p = body(page).locator('p')
  await p.click()
  await page.keyboard.type('teh ')
  await expect(p).toHaveText(/the\s/)
  await button(page, 'Geri al').click()
  await expect(p).toHaveText(/teh\s/)
  await p.click()
  await page.keyboard.press('End')
  await page.keyboard.type(';sig ')
  await expect(p).toContainText('Best regards')
  await expect(p).toContainText('<img src=x>')
  await expect(p.locator('img')).toHaveCount(0)
  await expect(p.locator('br')).toHaveCount(1)
  await page.keyboard.type('__proto__ (c) ')
  await expect(p).toContainText('__proto__ ©')
  await body(page).locator('code').click()
  await page.keyboard.press('End')
  await page.keyboard.type('teh ')
  await expect(body(page).locator('code')).toContainText('teh')
})
test('permanent pen follows caret, replaces selected text, groups undo and stops with Escape', async ({
  page,
}) => {
  await start(page)
  await menu(page, 'Biçim', 'Kalıcı kalem')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await page.getByRole('dialog').getByLabel('Metin rengi', { exact: true }).fill('#dd2244')
  await page.getByRole('spinbutton', { name: 'Kalem yazı boyutu' }).fill('22')
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Kalın', exact: true }).check()
  await button(page, 'Ayarları uygula').click()
  const p = body(page).locator('p')
  await body(page).focus()
  await p.first().selectText()
  await page.keyboard.type('New')
  await expect(p.first()).toHaveText('New')
  await expect(p.first().locator('span').first()).toHaveCSS('color', 'rgb(221, 34, 68)')
  await expect(p.first().locator('span').first()).toHaveCSS('font-size', '22px')
  await button(page, 'Geri al').click()
  await expect(p.first()).toHaveText('Original')
  await p.nth(1).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Pen')
  await expect(p.nth(1).locator('span').first()).toHaveCSS('color', 'rgb(221, 34, 68)')
  await page.keyboard.press('Escape')
  await expect(button(page, 'Kalıcı kalemi kapat')).toHaveCount(0)
  await p.first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Plain')
  await expect(p.first().locator('span')).toHaveCount(0)
})
test('autocorrect handles words split across permanent pen spans and preserves caret', async ({
  page,
}) => {
  await start(page, '<p><br></p>')
  await enableCorrections(page)
  await menu(page, 'Biçim', 'Kalıcı kalem')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await button(page, 'Ayarları uygula').click()
  await body(page).locator('p').click()
  await page.keyboard.type('teh next ')
  await expect(body(page).locator('p')).toHaveText(/the next\s/)
})
test('settings cancel keeps corrections off and mobile dialogs fit the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page, '<p><br></p>')
  await menu(page, 'Araçlar', 'Otomatik düzeltme ve metin kısayolları')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  const dialog = await page.getByRole('dialog').boundingBox()
  expect(dialog.x).toBeGreaterThanOrEqual(0)
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(390)
  const apply = await button(page, 'Ayarları uygula').boundingBox()
  expect(apply.y + apply.height).toBeLessThanOrEqual(844)
  await button(page, 'Vazgeç').click()
  await body(page).locator('p').click()
  await page.keyboard.type('teh ')
  await expect(body(page).locator('p')).toHaveText(/teh\s/)
  await menu(page, 'Dosya', 'Markdown içe aktar')
  await page.getByRole('textbox', { name: 'Markdown metni' }).fill('# Mobile')
  await expect(page.frameLocator('iframe[title="Markdown önizlemesi"]').locator('h1')).toHaveText(
    'Mobile',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('Markdown preserves complex tables, footnotes and merge fields as HTML on round trip', async ({
  page,
}) => {
  await start(
    page,
    '<p>Customer <span data-studio-field="Customer.Name">{{Customer.Name}}</span><sup data-studio-footnote-ref="fn-one"><a href="#fn-one">1</a></sup></p><table><tbody><tr><td colspan="2">Merged | value</td></tr></tbody></table><div data-studio-footnotes="true"><hr><ol><li id="fn-one" data-studio-footnote="true"><p>Source</p></li></ol></div>',
  )
  await menu(page, 'Dosya', 'Markdown dışa aktar')
  const source = await page.getByRole('textbox', { name: 'Markdown metni' }).inputValue()
  expect(source).toContain('colspan="2"')
  await button(page, 'Vazgeç').click()
  await menu(page, 'Dosya', 'Markdown içe aktar')
  await page.getByRole('textbox', { name: 'Markdown metni' }).fill(source)
  const preview = page.frameLocator('iframe[title="Markdown önizlemesi"]')
  await expect(preview.locator('[data-studio-field]')).toHaveText('{{Customer.Name}}')
  await expect(preview.locator('[data-studio-footnote-ref]')).toHaveText('1')
  await expect(preview.locator('[data-studio-footnote] p')).toHaveText('Source')
  await expect(preview.locator('td')).toHaveAttribute('colspan', '2')
})
