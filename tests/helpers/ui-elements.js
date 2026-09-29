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
    await dialog.getByRole('button', { name: 'Add a field', exact: true }).click()
    await dialog.getByRole('button', { name: 'Dropdown', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Department')
    await dialog.getByRole('textbox', { name: 'Field name', exact: true }).fill('email')
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(dialog.getByRole('alert')).toContainText('unique')
    await dialog.getByRole('textbox', { name: 'Field name', exact: true }).fill('department')
    await dialog.getByText('Edit choices in bulk', { exact: true }).click()
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
  test('live preview follows field and layout edits while invalid changes preserve the last valid preview', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await start(page)
    const dialog = await open(page)
    const preview = dialog.frameLocator('iframe')
    await expect(preview.getByRole('textbox', { name: 'Your name' })).toBeEnabled()
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Full name')
    await expect(preview.getByRole('textbox', { name: 'Full name' })).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('')
    await expect(dialog.getByText('Waiting for valid changes', { exact: true })).toBeVisible()
    await expect(preview.getByRole('textbox', { name: 'Full name' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Next item', exact: true }).click()
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toBeFocused()
    await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Customer name')
    await expect(preview.getByRole('textbox', { name: 'Customer name' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.getByRole('combobox', { name: 'Columns', exact: true }).selectOption('2')
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('Contact sales')
    await expect(preview.getByRole('heading', { name: 'Contact sales' })).toBeVisible()
    await expect
      .poll(async () => {
        const name = await preview.getByRole('textbox', { name: 'Customer name' }).boundingBox()
        const email = await preview.getByRole('textbox', { name: 'Email' }).boundingBox()
        return email.x > name.x && Math.abs(email.y - name.y) < 2
      })
      .toBe(true)
    await dialog.getByRole('button', { name: 'Mobile', exact: true }).click()
    const size = await dialog.locator('iframe').boundingBox()
    expect(size.width).toBeLessThanOrEqual(390)
  })
  test('field search, choice editing, keyboard reorder, delete recovery and discard protection work together', async ({
    page,
  }) => {
    await start(page)
    const dialog = await open(page)
    await dialog.getByRole('button', { name: 'Add a field', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Search fields', exact: true }).fill('choice')
    await expect(dialog.locator('.ui-palette-grid button')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('button', { name: 'Add a field', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Add a field', exact: true }).click()
    await dialog.getByRole('button', { name: 'Single choice', exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toBeFocused()
    await dialog.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Sales')
    await dialog.getByRole('button', { name: 'Add option', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Option 3', exact: true }).fill('Billing')
    await dialog.getByRole('button', { name: 'Remove option 2', exact: true }).click()
    const handle = dialog.getByRole('button', { name: 'Drag item 4', exact: true })
    await handle.focus()
    await page.keyboard.press('ArrowUp')
    await expect(dialog.locator('[data-ui-row="2"]')).toContainText('Single choice')
    await expect(dialog.getByRole('button', { name: 'Drag item 3', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Delete item', exact: true }).click()
    await expect(dialog.locator('[data-ui-row]')).toHaveCount(3)
    await dialog.getByRole('button', { name: 'Undo delete', exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: 'Option 2', exact: true })).toHaveValue(
      'Billing',
    )
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Discard your unsaved changes?')
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    const config = JSON.parse(
      await body(page).locator('[data-studio-ui]').getAttribute('data-studio-ui-config'),
    )
    expect(config.fields[2].options).toEqual(['Sales', 'Billing'])
  })
  test('slider validation selects the affected slide and accordion edits update the live preview', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await start(page)
    let dialog = await open(page, 'slider')
    await page.route('https://images.example.test/card.svg', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="blue"/></svg>',
      }),
    )
    await dialog.getByRole('button', { name: 'Add slide', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Item title', exact: true }).fill('New collection')
    await dialog
      .getByRole('textbox', { name: 'Image URL', exact: true })
      .fill('https://images.example.test/card.svg')
    await dialog.getByRole('button', { name: 'Previous item', exact: true }).click()
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    await expect(
      dialog.getByRole('textbox', { name: 'Alternative text', exact: true }),
    ).toBeFocused()
    await dialog
      .getByRole('textbox', { name: 'Alternative text', exact: true })
      .fill('Blue collection')
    await expect(
      dialog.frameLocator('iframe').getByRole('heading', { name: 'New collection' }),
    ).toHaveCount(1)
    await expect(dialog.locator('.slide-thumbnail img')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Insert element' }).click()
    dialog = await open(page, 'accordion')
    await dialog.getByRole('textbox', { name: 'Item title', exact: true }).fill('Shipping details')
    await dialog.getByRole('textbox', { name: 'Text', exact: true }).fill('Ships in two days.')
    await dialog.getByRole('checkbox', { name: 'Initially open', exact: true }).check()
    await expect(dialog.frameLocator('iframe').getByText('Ships in two days.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
    await expect(body(page).locator('[data-studio-ui="accordion"]')).toHaveCount(0)
  })
  test('long outlines scroll during pointer dragging and retain every field on drop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await start(page)
    await page.evaluate(() => {
      const config = window.lib.newUiElement('form')
      config.fields = Array.from({ length: 20 }, (_, index) => ({
        type: 'text',
        name: `field_${index}`,
        label: `Field ${index + 1}`,
      }))
      window.editor.setHTML(window.lib.uiElementHtml(config))
    })
    await body(page).locator('[data-studio-ui]').click()
    const dialog = page.getByRole('dialog', { name: 'Form builder' })
    const source = await dialog
      .getByRole('button', { name: 'Drag item 1', exact: true })
      .boundingBox()
    const list = dialog.locator('.ui-field-list'),
      box = await list.boundingBox()
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10, { steps: 8 })
    await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(150)
    await page.mouse.up()
    await dialog.getByRole('button', { name: 'Apply changes' }).click()
    const config = JSON.parse(
      await body(page).locator('[data-studio-ui]').getAttribute('data-studio-ui-config'),
    )
    expect(config.fields).toHaveLength(20)
    expect(new Set(config.fields.map((field) => field.name)).size).toBe(20)
    expect(config.fields.findIndex((field) => field.name === 'field_0')).toBeGreaterThan(3)
  })
  test('phone editing separates order and properties, and keeps adding and preview within reach', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await start(page, { locale: 'tr' })
    await page.evaluate(() => window.editor.openUiElement('form'))
    const dialog = page.getByRole('dialog', { name: 'Form oluşturucu' })
    await dialog.getByRole('button', { name: 'Alan ekle', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Alan ara', exact: true }).fill('tarih')
    await dialog.getByRole('button', { name: 'Tarih', exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: 'Etiket', exact: true })).toBeFocused()
    await dialog.getByRole('textbox', { name: 'Etiket', exact: true }).fill('Teslim tarihi')
    await dialog.getByRole('button', { name: /^Alanlar/ }).click()
    await expect(dialog.locator('[data-ui-row="3"]')).toContainText('Teslim tarihi')
    await dialog.locator('[data-ui-row="0"] .ui-field-select').click()
    await expect(dialog.getByRole('textbox', { name: 'Etiket', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Önizlemeyi dene', exact: true }).click()
    await expect(dialog.locator('iframe')).toBeVisible()
    const insert = dialog.getByRole('button', { name: 'Öğeyi ekle', exact: true })
    const bounds = await insert.boundingBox()
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    await insert.click()
    await expect(body(page).locator('[data-studio-ui="form"]')).toHaveCount(1)
  })
}
