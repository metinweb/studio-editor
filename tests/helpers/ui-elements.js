export function uiElementTests(test, expect) {
  test('mobile Turkish builder keeps actions visible and supports keyboard reopening', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await start(page, { locale: 'tr' })
    await page.evaluate(() => window.editor.openUiElement('accordion'))
    const dialog = page.getByRole('dialog', { name: 'Akordeon oluşturucu' })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    const insert = dialog.getByRole('button', { name: 'Öğeyi ekle', exact: true })
    const bounds = await insert.boundingBox()
    expect(bounds.y + bounds.height).toBeLessThan(844)
    await insert.click()
    const widget = body(page).locator('[data-studio-ui="accordion"]')
    await widget.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Öğeyi kaldır', exact: true }).click()
    await expect(widget).toHaveCount(0)
    await page.evaluate(() => window.editor.undo())
    await expect(widget).toHaveCount(1)
  })
  const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
  async function start(page, options = {}) {
    await page.goto('/integration/')
    await expect(page.locator('#status')).toHaveText('Editor ready')
    await page.getByRole('button', { name: 'Show textarea', exact: true }).click()
    await page.evaluate(async (options) => {
      window.lib = await import('/integration/editor/studio-editor.js')
      document.querySelector('#content').value = '<p>Article</p>'
      window.editor = await window.lib.mountStudioEditor('#content', options)
    }, options)
  }
  async function open(page, kind = 'form') {
    await page.evaluate((kind) => window.editor.openUiElement(kind), kind)
    return page.getByRole('dialog', {
      name: { form: 'Form builder', slider: 'Slider builder', accordion: 'Accordion builder' }[
        kind
      ],
      exact: true,
    })
  }
  test('form builder adds fields, validates names, previews without requests, edits and undoes', async ({
    page,
  }) => {
    await start(page)
    const dialog = await open(page)
    await dialog.getByRole('button', { name: 'Dropdown', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Department')
    await dialog.getByRole('textbox', { name: 'Field name', exact: true }).fill('email')
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(dialog.getByRole('alert')).toContainText('unique')
    await dialog.getByRole('textbox', { name: 'Field name', exact: true }).fill('department')
    await dialog.getByRole('textbox', { name: 'Options (one per line)' }).fill('Sales\nSupport')
    await dialog.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Submission URL (POST)' }).fill('/contact')
    await dialog.getByRole('combobox', { name: 'Columns', exact: true }).selectOption('2')
    let requests = 0
    await page.route('**/contact', (route) => {
      requests++
      return route.fulfill({ body: 'ok' })
    })
    await dialog.getByRole('button', { name: 'Try preview' }).click()
    const preview = dialog.frameLocator('iframe')
    await preview.getByRole('textbox', { name: 'Your name' }).fill('Reader')
    await preview.getByRole('textbox', { name: 'Email' }).fill('reader@example.com')
    await preview.getByRole('textbox', { name: 'Message' }).fill('Hello')
    await preview.getByRole('button', { name: 'Send message' }).click()
    expect(requests).toBe(0)
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    const widget = body(page).locator('[data-studio-ui="form"]')
    await expect(widget).toContainText('Department')
    await expect(body(page).locator('form,input,textarea,select')).toHaveCount(0)
    const exported = await page.evaluate(() => window.editor.getPublicHTML())
    expect(exported).toContain('method="post"')
    expect(exported).toContain('action="/contact"')
    expect(exported).toContain('name="department"')
    expect(exported).not.toContain('contenteditable')
    await widget.click()
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Full name')
    await dialog.getByRole('button', { name: 'Apply changes' }).click()
    await expect(widget).toContainText('Full name')
    await page.evaluate(() => window.editor.undo())
    await expect(widget).toContainText('Your name')
    await page.evaluate(() => window.editor.undo())
    await expect(widget).toHaveCount(0)
    await page.evaluate(() => window.editor.redo())
    await expect(widget).toHaveCount(1)
  })
  test('pointer drag and arrow ordering persist, and duplicate names are generated', async ({
    page,
  }) => {
    await start(page)
    const dialog = await open(page)
    const handle = dialog.getByRole('button', { name: 'Drag item 1', exact: true })
    const destination = dialog.locator('[data-ui-row="2"]')
    const a = await handle.boundingBox(),
      b = await destination.boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + 40, b.y + b.height / 2, { steps: 10 })
    await page.mouse.up()
    await expect(dialog.locator('[data-ui-row="2"]')).toContainText('Your name')
    await dialog.getByRole('button', { name: 'Move item 3 up', exact: true }).click()
    await dialog.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    const config = await body(page)
      .locator('[data-studio-ui]')
      .getAttribute('data-studio-ui-config')
    const fields = JSON.parse(config).fields
    expect(fields.map((field) => field.label)).toEqual([
      'Email',
      'Your name',
      'Your name',
      'Message',
    ])
    expect(new Set(fields.map((field) => field.name)).size).toBe(4)
  })
  test('slider and accordion publish native interactions and retain portable models', async ({
    page,
  }) => {
    await start(page)
    let dialog = await open(page, 'slider')
    await dialog.getByRole('textbox', { name: 'Item title', exact: true }).fill('Summer collection')
    await dialog
      .getByRole('textbox', { name: 'Image URL', exact: true })
      .fill('javascript:alert(1)')
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(dialog.getByRole('alert')).toContainText('HTTPS')
    await dialog.getByRole('textbox', { name: 'Image URL', exact: true }).fill('')
    await dialog.getByRole('button', { name: 'Try preview' }).click()
    const preview = dialog.frameLocator('iframe')
    await preview.getByRole('link', { name: '2', exact: true }).click()
    await expect
      .poll(() => preview.getByRole('region').evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(100)
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    dialog = await open(page, 'accordion')
    await dialog.getByRole('button', { name: 'Try preview' }).click()
    const details = dialog.frameLocator('iframe').locator('details').nth(1)
    await details.locator('summary').click()
    await expect(details).toHaveAttribute('open', '')
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await page.evaluate(() => {
      window.before = window.editor.getModel()
      window.editor.setModel(window.before)
    })
    await expect(body(page).locator('[data-studio-ui]')).toHaveCount(2)
    const model = await page.evaluate(() => JSON.stringify(window.editor.getModel()))
    expect(model).not.toContain('"tag":"details"')
    expect(model).not.toContain('"tag":"article"')
    const html = await page.evaluate(() => window.editor.getPublicHTML())
    expect(html).toContain('<details')
    expect(html).toContain('scroll-snap-type:')
  })
  test('published forms validate and submit native named fields to the configured endpoint', async ({
    page,
    context,
  }) => {
    await start(page)
    const html = await page.evaluate(() => {
      const config = window.lib.newUiElement('form')
      config.action = '/contact'
      window.editor.setHTML(window.lib.uiElementHtml(config))
      return window.editor.getPublicHTML()
    })
    const published = await context.newPage()
    let submissions = []
    await published.route('**/contact', (route) => {
      submissions.push(route.request().postData())
      return route.fulfill({ contentType: 'text/html', body: '<p>Received</p>' })
    })
    await published.route('**/published-ui', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    )
    await published.goto(new URL('/published-ui', page.url()).href)
    await published.getByRole('button', { name: 'Send message' }).click()
    expect(submissions).toEqual([])
    await published.getByRole('textbox', { name: 'Your name' }).fill('Ada')
    await published.getByRole('textbox', { name: 'Email' }).fill('ada@example.com')
    await published.getByRole('textbox', { name: 'Message' }).fill('Hello')
    await published.getByRole('button', { name: 'Send message' }).click()
    await expect(published.locator('body')).toHaveText('Received')
    expect(submissions).toEqual(['name=Ada&email=ada%40example.com&message=Hello'])
    await published.close()
  })
  test('UI definitions survive source, duplicates have unique IDs and malformed payloads are inert', async ({
    page,
  }) => {
    await start(page)
    const result = await page.evaluate(() => {
      const config = window.lib.newUiElement('form')
      config.action = '/contact'
      config.fields[0].label = '<img src=x onerror=alert(1)>'
      const portable = window.lib.uiElementHtml(config)
      window.editor.setHTML(portable + portable)
      const html = window.editor.getPublicHTML()
      const dom = new DOMParser().parseFromString(html, 'text/html')
      const ids = [...dom.querySelectorAll('[id]')].map((node) => node.id)
      window.editor.setHTML(html)
      return {
        ids,
        labels: dom.querySelector('label').textContent,
        scripts: dom.querySelectorAll('script,img').length,
        forms: dom.querySelectorAll('form').length,
      }
    })
    expect(result.forms).toBe(2)
    expect(new Set(result.ids).size).toBe(result.ids.length)
    expect(result.scripts).toBe(0)
    expect(result.labels).toContain('<img')
    await expect(body(page).locator('[data-studio-ui]')).toHaveCount(2)
    await page.evaluate(() =>
      window.editor.setHTML(
        '<figure data-studio-ui="form" data-studio-ui-config="{}"><form action="https://evil.example"><input name="secret"></form></figure>',
      ),
    )
    await expect(body(page).locator('[data-studio-ui],form,input')).toHaveCount(0)
    await expect(body(page)).toContainText('Invalid UI element')
  })
  test('readonly, feature disabling and stale documents prevent builder changes', async ({
    page,
  }) => {
    await start(page, { features: { uiElements: false } })
    await page.evaluate(() => window.editor.openUiElement())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(() => window.editor.setOptions({ features: {} }))
    const dialog = await open(page)
    await page.evaluate(() => window.editor.setHTML('<p>Changed elsewhere</p>'))
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(dialog.getByRole('alert')).toContainText('document changed')
    await page.evaluate(() => window.editor.setOptions({ readonly: true }))
    await expect(dialog).toHaveCount(0)
    await page.evaluate(() => window.editor.openUiElement())
    await expect(dialog).toHaveCount(0)
    await expect(body(page)).toHaveText('Changed elsewhere')
  })
}
