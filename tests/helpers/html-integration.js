export function htmlIntegrationTests(test, expect) {
  test('content styles apply only inside the editor, can be removed and report failures', async ({
    page,
  }) => {
    await page.route('**/article-theme.css', (route) =>
      route.fulfill({
        contentType: 'text/css',
        body: 'body { background: rgb(230, 240, 250); } p { color: rgb(12, 34, 56); font-size: 23px; }',
      }),
    )
    await custom(page)
    await page.evaluate(() => window.mountedEditor.openContentStyles())
    const dialog = page.getByRole('dialog', { name: 'Content style settings' })
    await dialog.getByRole('textbox', { name: 'External CSS URLs' }).fill('/article-theme.css')
    await dialog.getByRole('button', { name: 'Apply styles' }).click()
    await expect(dialog).toContainText('Loaded')
    await expect(body(page).locator('p')).toHaveCSS('font-size', '23px')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 248)')
    expect(await page.locator('#content').inputValue()).not.toContain('article-theme.css')
    await dialog.getByRole('textbox', { name: 'External CSS URLs' }).fill('javascript:alert(1)')
    await dialog.getByRole('button', { name: 'Apply styles' }).click()
    await expect(dialog.getByRole('alert')).toContainText('valid HTTP or HTTPS')
    await expect(body(page).locator('p')).toHaveCSS('font-size', '23px')
    await dialog.getByRole('button', { name: 'Restore default styles' }).click()
    await expect(body(page).locator('p')).not.toHaveCSS('font-size', '23px')
    await page.route('**/missing-theme.css', (route) =>
      route.fulfill({ status: 404, body: 'missing' }),
    )
    await dialog.getByRole('textbox', { name: 'External CSS URLs' }).fill('/missing-theme.css')
    await dialog.getByRole('button', { name: 'Apply styles' }).click()
    await expect(dialog).toContainText('Could not load CSS')
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.mountedEditor.setOptions({ allowContentCss: false }))
    await page.evaluate(() => window.mountedEditor.openContentStyles())
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
  const body = (page) => page.frameLocator('.studio-editor-frame').first().locator('body')
  async function open(page) {
    await page.goto('/integration/')
    await expect(page.locator('#status')).toHaveText('Editor ready')
  }
  async function custom(page, html = '<p>Initial</p>', options = {}) {
    await open(page)
    await page.getByRole('button', { name: 'Show textarea', exact: true }).click()
    await page.evaluate(
      async ({ html, options }) => {
        const { mountStudioEditor } = await import('/integration/editor/studio-editor.js')
        window.mountEditor = mountStudioEditor
        const source = document.querySelector('#content')
        source.defaultValue = html
        source.value = html
        window.changes = []
        window.mountedEditor = await mountStudioEditor(source, {
          ...options,
          onChange: (value) => window.changes.push(value),
        })
      },
      { html, options },
    )
  }

  test('HTML form submits edited content and resets without application setup', async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page)
    await body(page).fill('An edited article')
    await page.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(page.locator('#result')).toHaveText('Nothing submitted yet.')
    await page.getByRole('button', { name: 'Inspect form data' }).click()
    await expect(page.locator('#result')).toContainText('An edited article')
    await expect(page.locator('#content')).toHaveValue(/An edited article/)
    await page.getByRole('button', { name: 'Reset content' }).click()
    await expect(body(page)).toContainText('Welcome to your website')
    await expect(page.locator('body')).toHaveCSS('margin-top', '0px')
    await page.getByRole('button', { name: 'Show textarea', exact: true }).click()
    await expect(page.locator('#content')).toBeVisible()
    await expect(page.locator('.studio-editor-frame')).toHaveCount(0)
    await page.locator('#content').fill('<p>A different article</p>')
    await page.getByRole('button', { name: 'Show editor', exact: true }).click()
    await expect(body(page)).toHaveText('A different article')
    await body(page).click()
    await page.keyboard.press('Control+s')
    await expect(page.locator('#result')).toContainText('A different article')
    expect(errors).toEqual([])
  })

  test('required fields validate visible content and readonly/disabled follow native forms', async ({
    page,
  }) => {
    await custom(page, '<p><br></p>')
    await page.getByRole('button', { name: 'Inspect form data' }).click()
    await expect(page.getByRole('alert')).toHaveText('Please enter content.')
    await expect(page.locator('#result')).toHaveText('Nothing submitted yet.')
    await body(page).fill('Valid content')
    await expect(page.getByRole('alert')).toBeHidden()
    await page.evaluate(() => window.mountedEditor.setOptions({ readonly: true }))
    await expect(body(page)).toHaveAttribute('contenteditable', 'false')
    expect(
      await page.locator('#article-form').evaluate((form) => new FormData(form).get('content')),
    ).toContain('Valid content')
    await page.evaluate(() => window.mountedEditor.setOptions({ readonly: false, disabled: true }))
    expect(
      await page.locator('#article-form').evaluate((form) => new FormData(form).has('content')),
    ).toBe(false)
    await page.locator('#content').evaluate((element) => {
      element.disabled = false
    })
    await expect(body(page)).toHaveAttribute('contenteditable', 'true')
    await page.locator('label[for=content]').click()
    await expect(body(page)).toBeFocused()
  })

  test('mount lifecycle rejects duplicate targets, preserves form HTML and cleans listeners', async ({
    page,
  }) => {
    await custom(page)
    expect(await page.evaluate(() => window.mountedEditor.isDirty())).toBe(false)
    const duplicate = await page.evaluate(async () => {
      try {
        await window.mountEditor('#content')
      } catch (error) {
        return error.message
      }
    })
    expect(duplicate).toContain('already has an editor')
    await page.evaluate(() => window.mountedEditor.setHTML('<p>Updated via API</p>'))
    await expect(body(page)).toHaveText('Updated via API')
    expect(await page.evaluate(() => window.mountedEditor.isDirty())).toBe(true)
    await page.evaluate(() => window.mountedEditor.markClean())
    expect(await page.evaluate(() => window.mountedEditor.isDirty())).toBe(false)
    await page.evaluate(() =>
      window.mountedEditor.setOptions({ toolbar: ['insert'], menubar: false }),
    )
    await expect(page.getByRole('button', { name: 'Document preview', exact: true })).toBeVisible()
    await expect(page.locator('.native-menubar')).toHaveCount(0)
    await page.evaluate(() => window.mountedEditor.setOptions({ toolbar: false }))
    await expect(page.locator('.native-toolbar-row')).toHaveCount(0)
    await page.evaluate(() => {
      window.mountedEditor.destroy()
      window.mountedEditor.destroy()
      window.changes = []
      const source = document.querySelector('#content')
      source.value = '<p>External update</p>'
      source.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(await page.evaluate(() => window.changes)).toEqual([])
    await expect(page.locator('#content')).toBeVisible()
    await page.evaluate(async () => {
      window.mountedEditor = await window.mountEditor('#content')
    })
    await expect(body(page)).toHaveText('External update')
  })

  test('external textarea updates sanitize HTML and canceled form resets preserve edits', async ({
    page,
  }) => {
    await custom(page)
    await page.locator('#content').evaluate((source) => {
      source.value =
        '<p>Safe<img src="x" onerror="window.injected=1"></p><script>window.injected=1</script>'
      source.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(body(page)).toContainText('Safe')
    await expect(page.locator('#content')).not.toHaveValue(/onerror|<script>/)
    expect(await page.evaluate(() => window.injected)).toBeUndefined()
    await page.evaluate(() => {
      document
        .querySelector('form')
        .addEventListener('reset', (event) => event.preventDefault(), { once: true })
    })
    await page.getByRole('button', { name: 'Reset content' }).click()
    await expect(body(page)).toContainText('Safe')
    await page.getByRole('button', { name: 'Reset content' }).click()
    await expect(body(page)).toHaveText('Initial')
    expect(await page.evaluate(() => window.mountedEditor.isDirty())).toBe(false)
  })

  test('multiple mounted editors have independent values and respect disabled fieldsets', async ({
    page,
  }) => {
    await custom(page)
    await page.evaluate(async () => {
      const group = document.createElement('fieldset')
      group.id = 'other-group'
      group.innerHTML = '<textarea id="other" name="summary"><p>Summary</p></textarea>'
      document.querySelector('form').append(group)
      window.otherEditor = await window.mountEditor('#other', { height: 330 })
    })
    await expect(page.locator('.studio-editor-frame')).toHaveCount(2)
    await page.evaluate(() => window.mountedEditor.setHTML('<p>Changed main field</p>'))
    await expect(page.frameLocator('.studio-editor-frame').nth(1).locator('body')).toHaveText(
      'Summary',
    )
    await page.locator('#other-group').evaluate((group) => {
      group.disabled = true
    })
    await expect(page.frameLocator('.studio-editor-frame').nth(1).locator('body')).toHaveAttribute(
      'contenteditable',
      'false',
    )
    expect(await page.locator('form').evaluate((form) => new FormData(form).has('summary'))).toBe(
      false,
    )
    await page.locator('#other-group').evaluate((group) => {
      group.disabled = false
    })
    await expect(page.frameLocator('.studio-editor-frame').nth(1).locator('body')).toHaveAttribute(
      'contenteditable',
      'true',
    )
  })

  test('self-hosted module loads source dialog and fits a phone viewport', async ({ page }) => {
    await custom(page)
    await page.evaluate(() => window.mountedEditor.openSource())
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /HTML/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(body(page)).toHaveText('Initial')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
}
