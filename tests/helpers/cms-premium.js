export function cmsPremiumTests(test, expect) {
  const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
  async function start(page, html = '<p>Hello world</p>', options = {}) {
    await page.goto('/integration/')
    await expect(page.locator('#status')).toHaveText('Editor ready')
    await page.getByRole('button', { name: 'Show textarea', exact: true }).click()
    await page.evaluate(
      async ({ html, options }) => {
        window.library = await import('/integration/editor/studio-editor.js')
        document.querySelector('#content').value = html
        window.calls = []
        window.editor = await window.library.mountStudioEditor('#content', {
          ...options,
          assistanceAdapter: {
            label: 'Test fixture',
            generate: async (input, context) => {
              window.calls.push(input)
              if (window.delayed)
                return new Promise((resolve) => {
                  window.finish = resolve
                  context.signal.addEventListener('abort', () => {
                    window.aborted = true
                  })
                })
              return { text: '<b>Rewritten</b>\nSecond line' }
            },
            check: async (input) => {
              window.calls.push(input)
              return {
                issues: [{ offset: 3, length: 3, message: 'Spelling', replacements: ['the'] }],
              }
            },
          },
        })
      },
      { html, options },
    )
    await expect(body(page)).toBeVisible()
  }
  async function select(page) {
    await body(page).evaluate((root) => {
      root.focus()
      const range = root.ownerDocument.createRange()
      range.selectNodeContents(root)
      const selection = root.ownerDocument.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
  }
  test('AI is explicit, applies literal text, and creates one undo step', async ({ page }) => {
    await start(page)
    await select(page)
    await page.evaluate(() => window.editor.openAssistant())
    const dialog = page.getByRole('dialog', { name: 'AI writing assistant' })
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => window.calls.length)).toBe(0)
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: 'AI result' })).toHaveValue(
      '<b>Rewritten</b>\nSecond line',
    )
    expect(await page.evaluate(() => window.calls[0].text)).toBe('Hello world')
    await dialog.getByRole('button', { name: 'Replace selection' }).click()
    await expect(body(page)).toContainText('<b>Rewritten</b>')
    await expect(body(page).locator('b')).toHaveCount(0)
    await page.evaluate(() => window.editor.undo())
    await expect(body(page)).toHaveText('Hello world')
  })
  test('AI rejects stale responses and disabling a feature cancels pending work', async ({
    page,
  }) => {
    await start(page)
    await select(page)
    await page.evaluate(() => {
      window.delayed = true
      window.editor.openAssistant()
    })
    const dialog = page.getByRole('dialog', { name: 'AI writing assistant' })
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.finish)).toBe(true)
    await page.evaluate(() => {
      window.editor.setHTML('<p>New content</p>')
      window.finish({ text: 'Old response' })
    })
    await dialog.getByRole('button', { name: 'Replace selection' }).click()
    await expect(dialog.getByRole('alert')).toContainText('document changed')
    await expect(body(page)).toHaveText('New content')
    await page.keyboard.press('Escape')
    await select(page)
    await page.evaluate(() => {
      window.finish = null
      window.editor.openAssistant()
    })
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.finish)).toBe(true)
    await page.evaluate(() => window.editor.setOptions({ features: { ai: false } }))
    await expect(dialog).toHaveCount(0)
    expect(await page.evaluate(() => window.aborted)).toBe(true)
  })
  test('grammar corrections use UTF-16 offsets across formatted text and are undoable', async ({
    page,
  }) => {
    await start(page, '<p>😀 <strong>te</strong>h sample</p>')
    await select(page)
    await page.evaluate(() => window.editor.openAssistant('language'))
    const dialog = page.getByRole('dialog', { name: 'Spelling and grammar' })
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()
    await dialog.getByRole('button', { name: 'the', exact: true }).click()
    await expect(body(page)).toHaveText('😀 the sample')
    await page.evaluate(() => window.editor.undo())
    await expect(body(page)).toHaveText('😀 teh sample')
    await expect(body(page).locator('strong')).toHaveText('te')
  })
  test('feature policy blocks keyboard, menus and public dialog APIs, and can be re-enabled', async ({
    page,
  }) => {
    await start(page, '<p>Hello world</p>', {
      features: {
        formatting: false,
        media: false,
        science: false,
        source: false,
        pageEmbed: false,
      },
    })
    await select(page)
    await page.keyboard.press('Control+b')
    await expect(body(page).locator('strong,b')).toHaveCount(0)
    for (const method of ['openSource', 'openScience', 'openMedia', 'openPageEmbed'])
      await page.evaluate((method) => window.editor[method](), method)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Insert', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Math & chemistry', exact: true })).toHaveCount(
      0,
    )
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.editor.setOptions({ features: {} }))
    await select(page)
    await page.keyboard.press('Control+b')
    await expect(body(page).locator('strong,b')).toHaveText('Hello world')
  })
  test('content classes, inline CSS export and mobile preview use the website theme', async ({
    page,
  }) => {
    await page.route('**/theme.css', (route) =>
      route.fulfill({
        contentType: 'text/css',
        body: '.article p { color: rgb(12, 34, 56); font-size: 23px; }',
      }),
    )
    await start(page, '<p>Hello world</p>', { bodyClass: 'article', contentCss: ['/theme.css'] })
    await expect(body(page).locator('p')).toHaveCSS('color', 'rgb(12, 34, 56)')
    const output = await page.evaluate(() => window.editor.getInlineHTML())
    expect(output).toContain('rgb(12, 34, 56)')
    expect(output).not.toContain('contenteditable')
    expect(await page.evaluate(() => window.editor.getHTML())).not.toContain('rgb(12, 34, 56)')
    await page.getByRole('button', { name: 'Document preview', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Document preview', exact: true })
    await dialog.getByRole('button', { name: 'Mobile', exact: true }).click()
    await expect(dialog.locator('iframe')).toHaveCSS('width', '390px')
    await expect(dialog.frameLocator('iframe').locator('body')).toHaveClass('article')
    await dialog.getByRole('button', { name: 'Landscape' }).click()
    await expect(dialog.locator('iframe')).toHaveCSS('width', '844px')
  })
  test('page embeds stay sandboxed and portable through JSON, editing and undo', async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('https://example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>Example frame</p>' }),
    )
    await start(page)
    await select(page)
    await page.evaluate(() => window.editor.openPageEmbed())
    const dialog = page.getByRole('dialog', { name: 'Embed web page' })
    await dialog.getByRole('textbox', { name: 'Page URL' }).fill('javascript:alert(1)')
    await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com/article')
    await dialog.getByRole('textbox', { name: 'Accessible title' }).fill('Example article')
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    const figure = body(page).locator('figure[data-studio-page]')
    await expect(figure.locator('iframe')).toHaveAttribute('sandbox', '')
    const model = await page.evaluate(() => window.editor.getModel())
    expect(JSON.stringify(model)).not.toContain('"tag":"iframe"')
    await page.evaluate(() => window.editor.setModel(window.editor.getModel()))
    await expect(figure.locator('iframe')).toHaveAttribute('src', 'https://example.com/article')
    await figure.locator('figcaption').click()
    expect(errors).toEqual([])
    await dialog.getByRole('textbox', { name: 'Accessible title' }).fill('Updated title')
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(figure.locator('iframe')).toHaveAttribute('title', 'Updated title')
    await page.evaluate(() => window.editor.undo())
    await expect(figure.locator('iframe')).toHaveAttribute('title', 'Example article')
  })
  test('CMS binding autosaves and restores history as a new draft with the current version', async ({
    page,
  }) => {
    await start(page)
    await page.evaluate(async () => {
      window.saved = []
      window.binding = await window.library.bindDocumentSession(window.editor, {
        id: 'article',
        delay: 100,
        adapter: {
          load: async () => ({
            id: 'article',
            title: 'Article',
            html: '<p>Server content</p>',
            blockIds: [],
            version: 'v4',
          }),
          save: async (record, options) => {
            window.saved.push({ record, options })
            return { ...record, version: `v${4 + window.saved.length}` }
          },
          listVersions: async () => [{ version: 'v1', title: 'First draft' }],
          loadVersion: async () => ({
            id: 'article',
            title: 'First draft',
            html: '<p>Old draft</p>',
            version: 'v1',
            blockIds: [],
          }),
        },
      })
      window.editor.setOptions({ documentSession: window.binding.session })
    })
    await expect(body(page)).toHaveText('Server content')
    await body(page).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' edited')
    await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(1)
    await page.evaluate(() => window.editor.openVersionHistory())
    const dialog = page.getByRole('dialog', { name: 'CMS version history' })
    await dialog.getByRole('combobox', { name: 'Version', exact: true }).selectOption('v1')
    await dialog.getByRole('button', { name: 'Restore to draft' }).click()
    await expect(body(page)).toHaveText('Old draft')
    await expect.poll(() => page.evaluate(() => window.saved.length)).toBe(2)
    expect(await page.evaluate(() => window.saved[1].options.expectedVersion)).toBe('v5')
    await page.evaluate(() => {
      window.binding.dispose()
      window.editor.undo()
    })
    await expect(body(page)).toHaveText('Server content edited')
  })
}
