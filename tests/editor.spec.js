import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function document(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page, text, caret = false) {
  await body(page).evaluate(
    (root, { text, caret }) => {
      const document = root.ownerDocument
      const walker = document.createTreeWalker(root, 4)
      const nodes = []
      let all = ''
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        nodes.push({ node, offset: all.length })
        all += node.textContent
      }
      const index = all.indexOf(text)
      if (index === -1) throw new Error(`Selection text missing: ${text}`)
      const first = nodes.find(
        (item) => item.offset <= index && item.offset + item.node.length > index,
      )
      const last = nodes.find(
        (item) =>
          item.offset < index + text.length &&
          item.offset + item.node.length >= index + text.length,
      )
      const range = document.createRange()
      range.setStart(first.node, index - first.offset)
      range.setEnd(last.node, index + text.length - last.offset)
      if (caret) range.collapse(false)
      root.focus()
      document.getSelection().removeAllRanges()
      document.getSelection().addRange(range)
    },
    { text, caret },
  )
}

test('the visual editor never loads TinyMCE or calls execCommand', async ({ page }) => {
  const requests = []
  await page.addInitScript(() => {
    Document.prototype.execCommand = () => {
      throw new Error('Deprecated command called')
    }
  })
  page.on('request', (request) => requests.push(request.url()))
  await document(page, '<p>Bağımsız editör</p>')
  await select(page, 'Bağımsız')
  await page.getByRole('button', { name: 'Kalın', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('Bağımsız')
  expect(await page.evaluate(() => typeof window.tinymce)).toBe('undefined')
  expect(requests.filter((url) => /tinymce|\/plugins\/|\/skins\//i.test(url))).toEqual([])
  await expect(page.locator('.studio-editor-frame')).toHaveAttribute(
    'sandbox',
    'allow-same-origin allow-scripts',
  )
  await expect(
    page.frameLocator('.studio-editor-frame').locator('meta[http-equiv="Content-Security-Policy"]'),
  ).toHaveAttribute('content', /script-src 'none'/)
})

test('partial unbold preserves both sides, selection and undo/redo', async ({ page }) => {
  await document(page, '<p><strong>alpha beta gamma</strong></p>')
  await select(page, 'beta')
  await page.getByRole('button', { name: 'Kalın', exact: true }).click()
  await expect(body(page)).toHaveText('alpha beta gamma')
  await expect(body(page).locator('strong')).toHaveCount(2)
  expect(await body(page).evaluate((root) => root.ownerDocument.getSelection().toString())).toBe(
    'beta',
  )
  await expect(body(page).locator('[data-studio-marker]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('alpha beta gamma')
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveCount(2)
})

test('formatting across paragraphs preserves valid block structure', async ({ page }) => {
  await document(page, '<p>one two</p><p>three four</p>')
  await select(page, 'twothree')
  await page.getByRole('button', { name: 'İtalik', exact: true }).click()
  await expect(body(page).locator('p')).toHaveCount(2)
  await expect(body(page).locator('em')).toHaveText(['two', 'three'])
  await expect(body(page).locator('em p, p p')).toHaveCount(0)
  await page.getByRole('button', { name: 'Biçimlendirmeyi temizle' }).click()
  await expect(body(page).locator('em')).toHaveCount(0)
})

test('collapsed formatting and keyboard shortcuts apply to subsequent typing', async ({ page }) => {
  await document(page, '<p>Hello </p>')
  await select(page, 'Hello ', true)
  await page.keyboard.press('Control+b')
  await page.keyboard.type('bold')
  await expect(body(page).locator('strong')).toHaveText('bold')
  await page.keyboard.press('Control+b')
  await page.keyboard.type(' plain')
  await expect(body(page)).toHaveText('Hello bold plain')
  await expect(body(page).locator('strong')).toHaveText('bold')
})

test('headings, paragraph splitting and lists keep the caret in the right place', async ({
  page,
}) => {
  await document(page, '<h2>Başlık</h2>')
  await select(page, 'Başlık', true)
  await page.keyboard.press('Enter')
  await page.keyboard.type('First')
  await expect(body(page).locator('h2')).toHaveText('Başlık')
  await expect(body(page).locator('p')).toHaveText('First')
  await page.getByRole('button', { name: 'Madde işaretli liste' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second')
  await expect(body(page).locator('li')).toHaveText(['First', 'Second'])
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Outside')
  await expect(body(page).locator('li')).toHaveCount(2)
  await expect(body(page).locator('p')).toHaveText('Outside')
})

test('list conversion preserves unselected list items and nesting can be undone', async ({
  page,
}) => {
  await document(page, '<ul><li>one</li><li>two</li><li>three</li></ul>')
  await select(page, 'two')
  await page.getByRole('button', { name: 'Numaralı liste' }).click()
  await expect(body(page).locator('ul')).toHaveCount(2)
  await expect(body(page).locator('ol li')).toHaveText('two')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await select(page, 'two', true)
  await page.keyboard.press('Tab')
  await expect(body(page).locator('ul ul li')).toHaveText('two')
  await page.keyboard.press('Shift+Tab')
  await expect(body(page).locator('ul ul')).toHaveCount(0)
  await expect(body(page).locator('li')).toHaveText(['one', 'two', 'three'])
})

test('link dialog preserves selection and rejects executable URLs', async ({ page }) => {
  await document(page, '<p>Visit our site today.</p>')
  await select(page, 'our site')
  await page.getByRole('button', { name: 'Bağlantı ekle', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Bağlantı adresi', exact: true })
    .fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Bağlantıyı uygula' }).click()
  await expect(page.getByRole('alert')).toContainText('Geçerli')
  await page
    .getByRole('textbox', { name: 'Bağlantı adresi', exact: true })
    .fill('https://example.com')
  await page.getByRole('checkbox', { name: 'Yeni sekmede aç' }).check()
  await page.getByRole('button', { name: 'Bağlantıyı uygula' }).click()
  await expect(body(page).locator('a')).toHaveText('our site')
  await expect(body(page).locator('a')).toHaveAttribute('rel', 'noopener noreferrer')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('a')).toHaveCount(0)
})

test('tables support insertion, cell navigation, row/column edits and undo', async ({ page }) => {
  await document(page, '<p>Start</p>')
  await select(page, 'Start', true)
  await page.getByRole('button', { name: 'Tablo ekle', exact: true }).click()
  await page.getByRole('button', { name: 'Özel boyut…' }).click()
  await page.getByRole('spinbutton', { name: 'Satır sayısı' }).fill('2')
  await page.getByRole('spinbutton', { name: 'Sütun sayısı' }).fill('2')
  await page.getByRole('button', { name: 'Tabloyu oluştur' }).click()
  await expect(body(page).locator('tr')).toHaveCount(2)
  await page.keyboard.type('Name')
  await page.keyboard.press('Tab')
  await page.keyboard.type('Value')
  await expect(body(page).locator('th')).toHaveText(['Name', 'Value'])
  await page.getByRole('button', { name: 'Satır ekle', exact: true }).click()
  await expect(body(page).locator('tr')).toHaveCount(3)
  await page.getByRole('button', { name: 'Sütun ekle', exact: true }).click()
  await expect(body(page).locator('tr').first().locator('th')).toHaveCount(3)
  await page.getByRole('button', { name: 'Sütunu sil', exact: true }).click()
  await expect(body(page).locator('tr').first().locator('th')).toHaveCount(2)
  await page.getByRole('button', { name: 'Tabloyu sil', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('table')).toHaveCount(1)
})

test('search and replace span inline formatting and undo as one operation', async ({ page }) => {
  await document(page, '<p>Hello <strong>world</strong>, Hello world.</p>')
  await page.getByRole('button', { name: 'Bul ve değiştir', exact: true }).click()
  await page.getByRole('textbox', { name: 'Aranacak metin' }).fill('Hello world')
  await expect(page.locator('.find-count')).toHaveText('0 / 2')
  await page.getByRole('textbox', { name: 'Yerine yazılacak metin' }).fill('Studio')
  await page.getByRole('button', { name: 'Tümünü değiştir', exact: true }).click()
  await expect(body(page)).toHaveText('Studio, Studio.')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Hello world, Hello world.')
})

test('pasted HTML is sanitized and blocks are not nested inside paragraphs', async ({ page }) => {
  await document(page, '<p>Before After</p>')
  await select(page, 'Before ', true)
  await body(page).evaluate((root) => {
    const doc = root.ownerDocument,
      win = doc.defaultView
    const data = new win.DataTransfer()
    data.setData(
      'text/html',
      '<p><strong>Pasted</strong><script>parent.hacked=true</script></p><p onclick="alert(1)">Second</p><style>body{display:none}</style>',
    )
    const event = new win.ClipboardEvent('paste', { bubbles: true, cancelable: true })
    // Firefox ignores clipboardData in synthetic ClipboardEvent constructors.
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
  })
  await expect(body(page)).toContainText('PastedSecondAfter')
  await expect(body(page).locator('p p,script,style,[onclick]')).toHaveCount(0)
  expect(await page.evaluate(() => window.hacked)).toBeUndefined()
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Before After')
})

test('colors, fonts, headings and alignment survive export-facing source edits', async ({
  page,
}) => {
  await document(page, '<p>Colorful text</p>')
  await select(page, 'Colorful')
  await page.getByRole('button', { name: 'Yazı tipi', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Arial', exact: true }).click()
  await page.getByRole('button', { name: 'Yazı boyutu', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '24 px', exact: true }).click()
  await page.getByRole('button', { name: 'Paragraf biçimi', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Başlık 2', exact: true }).click()
  await page.getByRole('button', { name: 'Ortala', exact: true }).click()
  await expect(body(page).locator('h2')).toHaveCSS('text-align', 'center')
  await expect(body(page).locator('span').filter({ hasText: 'Colorful' }).last()).toHaveCSS(
    'font-size',
    '24px',
  )
  await expect(body(page).locator('span').filter({ hasText: 'Colorful' }).last()).toHaveCSS(
    'font-family',
    'Arial, sans-serif',
  )
})

test('code snippets are escaped, fullscreen exits with Escape', async ({ page }) => {
  await document(page, '<p>Example</p>')
  await page.getByRole('button', { name: 'Ekle', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Kod bloğu ekle', exact: true }).click()
  await page.getByRole('textbox', { name: 'Eklenecek kod' }).fill('<script>alert("test")</script>')
  await page.getByRole('button', { name: 'Kod bloğunu ekle', exact: true }).click()
  await expect(body(page).locator('pre code')).toHaveText('<script>alert("test")</script>')
  await expect(body(page).locator('script')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tam ekran', exact: true }).click()
  await expect(page.locator('.native-editor')).toHaveClass(/native-fullscreen/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.native-editor')).not.toHaveClass(/native-fullscreen/)
})

test('typing is grouped and a divergent edit clears redo', async ({ page }) => {
  await document(page, '<p>Start </p>')
  await select(page, 'Start ', true)
  await page.keyboard.type('hello')
  await page.keyboard.press('Control+z')
  await expect(body(page)).toHaveText('Start ')
  await page.keyboard.press('Control+Shift+z')
  await expect(body(page)).toHaveText('Start hello')
  await page.keyboard.press('Control+z')
  await page.keyboard.type('different')
  await expect(page.getByRole('button', { name: 'Yinele', exact: true })).toBeDisabled()
  await expect(body(page)).toHaveText('Start different')
})

test('an IME composition commits as a single undoable change', async ({ page }) => {
  await document(page, '<p>Text </p>')
  await select(page, 'Text ', true)
  await body(page).evaluate((root) => {
    const win = root.ownerDocument.defaultView
    root.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true }))
    root.querySelector('p').append('日本語')
    root.dispatchEvent(
      new win.InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        isComposing: true,
        data: '日本語',
      }),
    )
    root.dispatchEvent(
      new win.CompositionEvent('compositionend', { bubbles: true, data: '日本語' }),
    )
  })
  await expect(body(page)).toHaveText('Text 日本語')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toHaveText('Text ')
})

test('frame CSP blocks scripts even if HTML sanitization is bypassed', async ({ page }) => {
  await document(page, '<p>Safe document</p>')
  await body(page).evaluate((root) => {
    const doc = root.ownerDocument
    const script = doc.createElement('script')
    script.textContent = 'window.parent.studioScriptExecuted = true'
    root.append(script)
    const image = doc.createElement('img')
    image.setAttribute('onerror', 'window.parent.studioHandlerExecuted = true')
    root.append(image)
    image.dispatchEvent(new doc.defaultView.Event('error'))
  })
  expect(
    await page.evaluate(() => [window.studioScriptExecuted, window.studioHandlerExecuted]),
  ).toEqual([undefined, undefined])
})

test('plain paste stays inline and newly typed root text can be formatted', async ({ page }) => {
  await document(page, '<p>Before After</p>')
  await select(page, 'Before ', true)
  await body(page).evaluate((root) => {
    const win = root.ownerDocument.defaultView
    const data = new win.DataTransfer()
    data.setData('text/plain', 'pasted ')
    const event = new win.ClipboardEvent('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
  })
  await expect(body(page).locator('p')).toHaveCount(1)
  await expect(body(page)).toHaveText('Before pasted After')
  await body(page).fill('Fresh text')
  await select(page, 'Fresh')
  await page.getByRole('button', { name: 'Paragraf biçimi', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Başlık 2', exact: true }).click()
  await expect(body(page).locator('h2')).toHaveText('Fresh text')
})
