import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const widget = (page) => body(page).locator('figure[data-studio-embed]')
const bar = (page) => page.getByRole('toolbar', { name: 'Gömülü medya araçları' })
async function setup(page, html = '<p>Önce</p><p>Sonra</p>') {
  // Provider playback is external; these tests assert our integration deterministically.
  await page.route(/https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Player fixture</p>' }),
  )
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await body(page).locator('p').last().click()
  await page.keyboard.press('End')
}
async function add(page, url = 'https://youtu.be/M7lc1UVf-VE?t=90') {
  await page.getByRole('button', { name: 'Bağlantıdan medya ekle', exact: true }).click()
  await page.getByRole('textbox', { name: 'Medya bağlantısı', exact: true }).fill(url)
  await page.getByRole('textbox', { name: 'Medya açıklaması', exact: true }).fill('Tanıtım videosu')
  await page.getByRole('button', { name: 'Medyayı ekle', exact: true }).click()
}
async function paste(page, text, html = '', plain = false) {
  await body(page).evaluate(
    (root, { text, html, plain }) => {
      root.focus()
      if (plain)
        root.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, shiftKey: true, bubbles: true }),
        )
      const data = new DataTransfer()
      data.setData('text/plain', text)
      data.setData('text/html', html)
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: data })
      root.dispatchEvent(event)
    },
    { text, html, plain },
  )
}

test('embed dialog validates links, previews and persists a canonical player with one undo', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: 'Bağlantıdan medya ekle', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Medya bağlantısı', exact: true })
    .fill('https://youtube.com.evil.test/watch?v=M7lc1UVf-VE')
  await expect(page.getByRole('button', { name: 'Medyayı ekle', exact: true })).toBeDisabled()
  await page
    .getByRole('textbox', { name: 'Medya bağlantısı', exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE?t=1m30s')
  await page.getByRole('button', { name: 'Önizlemeyi aç' }).click()
  await expect(page.locator('.embed-preview iframe')).toHaveAttribute('src', /start=90$/)
  await page.getByRole('textbox', { name: 'Medya açıklaması' }).fill('Tanıtım videosu')
  await page.getByRole('button', { name: 'Medyayı ekle', exact: true }).click()
  await expect(widget(page).locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=90',
  )
  await expect(widget(page).locator('figcaption')).toHaveText('Tanıtım videosu')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(widget(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(widget(page)).toHaveCount(1)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(widget(page).locator('iframe')).toHaveAttribute('src', /start=90$/)
})

test('contextual tools update size, alignment, URL, caption and delete with undo', async ({
  page,
}) => {
  await setup(page)
  await add(page)
  await widget(page).locator('figcaption').click()
  await expect(bar(page)).toBeVisible()
  await bar(page).getByRole('button', { name: 'Medya genişliği 50%' }).click()
  await expect(widget(page)).toHaveAttribute('data-studio-embed-width', '50')
  await bar(page).getByRole('button', { name: 'Medyayı sağa hizala' }).click()
  await expect(widget(page)).toHaveAttribute('data-studio-embed-align', 'right')
  await bar(page).getByRole('button', { name: 'Gömülü medyayı düzenle' }).click()
  await page
    .getByRole('textbox', { name: 'Medya bağlantısı', exact: true })
    .fill('https://vimeo.com/123456789/5e2d1c1e6d')
  await page.getByRole('textbox', { name: 'Medya açıklaması', exact: true }).fill('Yeni açıklama')
  await page.getByRole('button', { name: 'Medyayı güncelle' }).click()
  await expect(widget(page).locator('iframe')).toHaveAttribute(
    'src',
    'https://player.vimeo.com/video/123456789?h=5e2d1c1e6d',
  )
  await expect(widget(page).locator('figcaption')).toHaveText('Yeni açıklama')
  await widget(page).locator('figcaption').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Gömülü medyayı sil', exact: true }).click()
  await expect(widget(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(widget(page).locator('figcaption')).toHaveText('Yeni açıklama')
})

test('standalone URL auto-embeds but plain paste and selected text stay links/text', async ({
  page,
}) => {
  await setup(page)
  await paste(page, 'https://youtu.be/M7lc1UVf-VE')
  await expect(widget(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await paste(page, 'https://youtu.be/M7lc1UVf-VE', '', true)
  await expect(widget(page)).toHaveCount(0)
  await expect(body(page)).toContainText('https://youtu.be/M7lc1UVf-VE')
  await body(page).locator('p').first().selectText()
  await paste(page, 'https://youtu.be/M7lc1UVf-VE')
  await expect(widget(page)).toHaveCount(0)
  await expect(body(page).locator('a')).toHaveText('Önce')
})

test('sanitizer rebuilds trusted widgets, rejects arbitrary iframes and preserves copied widgets', async ({
  page,
}) => {
  await setup(
    page,
    '<p>Test</p><iframe src="https://evil.test"></iframe><figure data-studio-embed="https://youtu.be/M7lc1UVf-VE"><iframe src="https://evil.test" srcdoc="bad"></iframe><figcaption><img src=x onerror="alert(1)"></figcaption></figure><p>Son</p>',
  )
  await expect(body(page).locator('iframe')).toHaveCount(1)
  await expect(body(page).locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  )
  await expect(body(page).locator('[srcdoc],[onerror],img')).toHaveCount(0)
  const html = await widget(page).evaluate((node) => node.outerHTML)
  await paste(page, 'Video', html)
  await expect(widget(page)).toHaveCount(2)
  await expect(body(page).locator('iframe')).toHaveCount(2)
})

test('keyboard exit and delete plus pointer resize are reversible', async ({ page }) => {
  await setup(page)
  await add(page)
  await widget(page).locator('figcaption').click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Videodan sonra')
  await expect(body(page)).toContainText('Videodan sonra')
  await widget(page).locator('figcaption').click()
  const handle = page.getByRole('button', { name: 'Medya genişliğini değiştir' })
  const rect = await handle.boundingBox()
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.mouse.move(rect.x - 70, rect.y, { steps: 8 })
  await page.mouse.up()
  await expect(widget(page)).not.toHaveAttribute('data-studio-embed-width', '100')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(widget(page)).toHaveAttribute('data-studio-embed-width', '100')
  await widget(page).locator('figcaption').click()
  await page.keyboard.press('Delete')
  await expect(widget(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(widget(page)).toHaveCount(1)
})

test('rich URL paste auto-embeds and text formatting never edits the media caption', async ({
  page,
}) => {
  await setup(page)
  await paste(
    page,
    'https://youtu.be/M7lc1UVf-VE',
    '<a href="https://youtu.be/M7lc1UVf-VE">https://youtu.be/M7lc1UVf-VE</a>',
  )
  await expect(widget(page)).toHaveCount(1)
  const caption = await widget(page).locator('figcaption').innerHTML()
  await body(page).evaluate((root) => {
    root.focus()
    const range = root.ownerDocument.createRange()
    range.selectNodeContents(root)
    const selection = root.ownerDocument.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await page.getByRole('button', { name: 'Kalın', exact: true }).click()
  expect(await widget(page).locator('figcaption').innerHTML()).toBe(caption)
  await expect(body(page).locator('p strong').first()).toBeVisible()
})

test('narrow screen tools and dialog fit, keyboard resize works and Escape cancels dragging', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.getByRole('button', { name: 'Ekle', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Bağlantıdan medya ekle' }).click()
  await page
    .getByRole('textbox', { name: 'Medya bağlantısı', exact: true })
    .fill('https://vimeo.com/76979871')
  const dialog = await page.getByRole('dialog').boundingBox()
  expect(dialog.x).toBeGreaterThanOrEqual(0)
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(391)
  await page.getByRole('button', { name: 'Medyayı ekle', exact: true }).click()
  await widget(page).locator('figcaption').click()
  const box = await bar(page).boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(391)
  const handle = page.getByRole('button', { name: 'Medya genişliğini değiştir' })
  await handle.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(widget(page)).toHaveAttribute('data-studio-embed-width', '95')
  const start = await handle.boundingBox()
  await page.mouse.move(start.x + 6, start.y + 6)
  await page.mouse.down()
  await page.mouse.move(start.x - 40, start.y)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(widget(page)).toHaveAttribute('data-studio-embed-width', '95')
  expect(await widget(page).evaluate((node) => node.style.width)).toBe('95%')
})
