import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function setup(page, html = '<p>Başlangıç</p>') {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await body(page).evaluate((root) => {
    root.focus()
    const range = root.ownerDocument.createRange()
    range.selectNodeContents(root.lastElementChild)
    range.collapse(false)
    const selection = root.ownerDocument.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
}
async function paste(page, data) {
  await body(page).evaluate((root, data) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/html', data.html || '')
    clipboard.setData('text/plain', data.text || '')
    if (data.file) {
      const bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        ),
        (c) => c.charCodeAt(0),
      )
      clipboard.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }))
    }
    if (data.shift)
      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, shiftKey: true, bubbles: true }),
      )
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: clipboard })
    root.dispatchEvent(event)
  }, data)
}
test('Word nested lists are normalized, sanitized and undone together', async ({ page }) => {
  await setup(page)
  await paste(page, {
    html: '<!--StartFragment--><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">3. </span><b>Üç</b></p><p style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">• </span>İç madde</p><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">4. </span>Dört<img src="javascript:alert(1)" onerror="alert(1)"></p><!--EndFragment-->',
  })
  await expect(body(page).locator('ol')).toHaveAttribute('start', '3')
  await expect(body(page).locator('ol > li')).toHaveCount(2)
  await expect(body(page).locator('ol > li > ul > li')).toHaveText('İç madde')
  await expect(body(page).locator('[class*=Mso],[onerror],[data-studio-paste-image]')).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Başlangıç')
})
test('quoted spreadsheet TSV becomes a table without interpreting markup', async ({ page }) => {
  await setup(page)
  await paste(page, { text: '"a\tb"\t"one\ntwo"\t\r\n<img src=x>\t0\t\r\n' })
  await expect(body(page).locator('tr')).toHaveCount(2)
  await expect(body(page).locator('td')).toHaveCount(6)
  expect(await body(page).locator('td').nth(0).textContent()).toBe('a\tb')
  await expect(body(page).locator('td').nth(1).locator('br')).toHaveCount(1)
  await expect(body(page).locator('td').nth(3)).toHaveText('<img src=x>')
  await expect(body(page).locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Başlangıç')
})
test('clean formatting retains Docs headings and table structure', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Düzenle', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Yapıştır: biçimi temizle', exact: true }).click()
  await paste(page, {
    html: '<b id="docs-internal-guid-1"><h2 style="color:red">Başlık</h2><table><tr><td style="background-color:blue"><strong>Hücre</strong></td></tr></table></b>',
  })
  await expect(body(page).locator('h2')).toHaveText('Başlık')
  await expect(body(page).locator('td')).toHaveText('Hücre')
  await expect(body(page).locator('strong,b,[style],[id^=docs-]')).toHaveCount(0)
})
test('plain paste and preformatted blocks preserve text instead of creating tables', async ({
  page,
}) => {
  await setup(page)
  await paste(page, { html: '<table><tr><td>rich</td></tr></table>', text: 'a\tb', shift: true })
  await expect(body(page).locator('table')).toHaveCount(0)
  await expect(body(page)).toContainText('a b')
  await setup(page, '<pre>code:</pre>')
  await paste(page, { text: 'a\tb\nc\td' })
  expect(await body(page).locator('pre').textContent()).toBe('code:a\tb\nc\td')
  await expect(body(page).locator('table')).toHaveCount(0)
})
test('mixed text and local image paste keeps position with one undo step', async ({ page }) => {
  await setup(page)
  await paste(page, {
    html: '<p>Önce<img src="file:///image.png" alt="Pano">Sonra</p>',
    text: 'ÖnceSonra',
    file: true,
  })
  await expect(body(page).locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(body(page)).toContainText('ÖnceSonra')
  await expect(body(page).locator('img')).toHaveCount(1)
  await expect(body(page).locator('[data-studio-paste-image]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Başlangıç')
  await expect(body(page).locator('img')).toHaveCount(0)
})
test('HTML images represented on the clipboard are not appended twice', async ({ page }) => {
  await setup(page)
  await paste(page, { html: '<p>Resim<img src="https://example.com/image.png"></p>', file: true })
  await expect(body(page).locator('img')).toHaveCount(1)
  await expect(body(page).locator('img')).toHaveAttribute('src', 'https://example.com/image.png')
})
test('image-looking plain text does not hide a pasted image file', async ({ page }) => {
  await setup(page)
  await paste(page, { text: '<img src=example>', file: true })
  await expect(body(page).locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(body(page)).toContainText('<img src=example>')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Başlangıç')
})
test('oversized paste leaves the document and undo history unchanged', async ({ page }) => {
  await setup(page)
  await paste(page, { text: 'x'.repeat(5 * 1024 * 1024 + 1) })
  await expect(body(page)).toHaveText('Başlangıç')
  await expect(page.getByText('Pano içeriği çok büyük; HTML içe aktarmayı kullanın.')).toBeVisible()
})
