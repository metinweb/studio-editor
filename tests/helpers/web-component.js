/** Shared by the website tests and the installed-package tests. */
export function webComponentTests(test, expect) {
  const element = (page) => page.locator('studio-editor')
  const body = (page) => page.frameLocator('studio-editor .studio-editor-frame').locator('body')
  async function open(page, build = '') {
    await page.goto(`/integration/element.html${build ? `?build=${build}` : ''}`)
    await expect(page.locator('#status')).toHaveText(
      build === 'lite' ? 'Lite editor ready' : 'Editor ready',
    )
  }

  test('custom element submits, resets and validates as a form control', async ({ page }) => {
    await open(page)
    await expect(body(page).locator('h2')).toHaveText('Hello from a web component')
    await body(page).locator('p').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Typed')
    await expect.poll(() => page.evaluate(() => window.events.includes('input'))).toBe(true)
    await page.getByRole('button', { name: 'Inspect form data' }).click()
    await expect(page.locator('#result')).toContainText('Edit me. Typed')
    expect(await element(page).evaluate((node) => node.value)).toContain('Typed')
    await page.getByRole('button', { name: 'Reset content' }).click()
    await expect(body(page).locator('p')).toHaveText('Edit me.')
    await element(page).evaluate((node) => (node.value = '<p><br></p>'))
    expect(await element(page).evaluate((node) => node.checkValidity())).toBe(false)
    await page.getByRole('button', { name: 'Inspect form data' }).click()
    await expect(page.locator('#status')).toHaveText('Please enter content')
    await element(page).evaluate((node) => (node.value = '<p>Restored</p>'))
    expect(await element(page).evaluate((node) => node.checkValidity())).toBe(true)
    await expect(body(page).locator('p')).toHaveText('Restored')
  })

  test('attributes and properties reconfigure the mounted editor', async ({ page }) => {
    await open(page)
    const host = element(page)
    await expect(host.getByRole('button', { name: 'Insert table' })).toBeVisible()
    await host.evaluate((node) => node.setAttribute('disable-features', 'tables media'))
    await expect(host.getByRole('button', { name: 'Insert table' })).toHaveCount(0)
    await expect(host.getByRole('button', { name: 'Open media library' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Toggle readonly' }).click()
    await expect(body(page)).toHaveAttribute('contenteditable', 'false')
    await expect(host.getByRole('toolbar')).toHaveCount(0)
    await page.getByRole('button', { name: 'Toggle readonly' }).click()
    await expect(body(page)).toHaveAttribute('contenteditable', 'true')
    await host.evaluate((node) => node.setAttribute('toolbar', 'history format'))
    await expect(host.getByRole('button', { name: 'Bold', exact: true })).toBeVisible()
    await expect(host.getByRole('button', { name: 'Align left' })).toHaveCount(0)
    await host.evaluate((node) => node.setAttribute('locale', 'tr'))
    await expect(host.getByRole('button', { name: 'Kalın', exact: true })).toBeVisible()
    const api = await host.evaluate((node) => typeof node.editor?.getPublicHTML)
    expect(api).toBe('function')
  })

  test('theme attribute darkens the embedded interface and its teleported menus', async ({
    page,
  }) => {
    await open(page)
    const host = element(page)
    const background = (locator) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor)
    const dark = (color) =>
      color
        .match(/\d+/g)
        .slice(0, 3)
        .every((value) => Number(value) < 60)
    const toolbar = host.locator('.native-editor')
    expect(dark(await background(toolbar))).toBe(false)
    await host.evaluate((node) => node.setAttribute('theme', 'dark'))
    await expect(host.locator('.studio-editor-embed')).toHaveAttribute('data-studio-theme', 'dark')
    expect(dark(await background(toolbar))).toBe(true)
    // The document sheet stays white with readable text (found in the CodeCMS integration).
    const paper = await body(page).evaluate((root) => ({
      background: getComputedStyle(root.ownerDocument.documentElement).backgroundColor,
      color: getComputedStyle(root).color,
    }))
    expect(paper.background).toBe('rgb(255, 255, 255)')
    expect(
      paper.color
        .match(/\d+/g)
        .slice(0, 3)
        .every((value) => Number(value) < 100),
    ).toBe(true)
    await expect(host.locator('.studio-editor-embed')).toHaveCSS('color-scheme', 'dark')
    await host.getByRole('button', { name: 'Insert', exact: true }).click()
    const popover = page.locator('.editor-popover')
    await expect(popover).toHaveAttribute('data-studio-theme', 'dark')
    expect(dark(await background(popover))).toBe(true)
    await page.keyboard.press('Escape')
    await host.evaluate((node) => node.setAttribute('theme', 'light'))
    expect(dark(await background(toolbar))).toBe(false)
  })

  test('host-enforced restricted mode edits only regions and still accepts host updates', async ({
    page,
  }) => {
    await open(page)
    const host = element(page)
    await host.evaluate(
      (node) =>
        (node.value = '<p>Dear <span data-studio-editable="name">Name</span>, welcome.</p>'),
    )
    await host.evaluate((node) => node.setAttribute('restricted', ''))
    await expect(body(page)).toHaveAttribute('data-restricted', 'true')
    await expect(host.getByRole('button', { name: 'Insert table' })).toHaveCount(0)
    await body(page).locator('span[data-studio-editable]').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('Ada')
    await expect(body(page).locator('p')).toHaveText('Dear Ada, welcome.')
    expect(await host.evaluate((node) => node.editor.getEditableRegions())).toEqual([
      { name: 'name', kind: 'inline', text: 'Ada', html: 'Ada' },
    ])
    expect(await host.evaluate((node) => node.value)).not.toContain('contenteditable')
    await host.evaluate(
      (node) => (node.value = '<p>Replaced <span data-studio-editable="true">x</span></p>'),
    )
    await expect(body(page).locator('p')).toHaveText('Replaced x')
    await host.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Next editable region' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Restricted editing mode' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Make editable region' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await host.evaluate((node) => node.removeAttribute('restricted'))
    await expect(body(page)).not.toHaveAttribute('data-restricted', 'true')
  })

  test('host-enforced track changes records authored suggestions and publishes the original', async ({
    page,
  }) => {
    await open(page)
    const host = element(page)
    await host.evaluate((node) => {
      node.user = { id: 'ayse', name: 'Ayşe' }
      node.value = '<p>Hello world</p>'
      node.setAttribute('track-changes', '')
    })
    await expect(host.locator('.native-statusbar')).toContainText('Tracking changes')
    await body(page).evaluate((root) => {
      const range = root.ownerDocument.createRange()
      range.setStart(root.querySelector('p').firstChild, 5)
      range.collapse(true)
      root.focus()
      root.ownerDocument.getSelection().removeAllRanges()
      root.ownerDocument.getSelection().addRange(range)
    })
    await page.keyboard.type(' there')
    await expect(body(page).locator('ins')).toHaveAttribute('data-studio-author', 'ayse')
    expect(await host.evaluate((node) => node.getPublicHTML())).toBe('<p>Hello world</p>')
    expect(await host.evaluate((node) => node.value)).toContain('data-studio-change="insert"')
    expect(await host.evaluate((node) => node.editor.getTrackedChanges())).toMatchObject([
      { type: 'insert', author: 'ayse', authorName: 'Ayşe', inserted: ' there' },
    ])
    await host.getByRole('button', { name: 'Tools', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Tracked changes' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Track changes', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    expect(await host.evaluate((node) => node.editor.acceptAllChanges())).toBe(true)
    expect(await host.evaluate((node) => node.getPublicHTML())).toBe('<p>Hello there world</p>')
    await host.evaluate((node) => node.removeAttribute('track-changes'))
    await expect(host.locator('.native-statusbar')).not.toContainText('Tracking changes')
  })

  test('moving keeps content and removal unmounts the editor', async ({ page }) => {
    await open(page)
    await element(page).evaluate((node) => (node.value = '<p>Moved content</p>'))
    await page.evaluate(() =>
      document.querySelector('main').prepend(document.querySelector('#editor')),
    )
    await expect(body(page).locator('p')).toHaveText('Moved content')
    await page.evaluate(() => document.querySelector('#editor').remove())
    await expect(page.locator('.studio-editor-frame')).toHaveCount(0)
  })

  test('the packaged editor restarts after a failure and reports it', async ({ page }) => {
    await open(page)
    await page.evaluate(() => {
      window.crashes = []
      document
        .querySelector('studio-editor')
        .addEventListener('studio-crash', (event) => window.crashes.push(event.detail))
    })
    await element(page).evaluate((node) => (node.value = '<p>Survives a crash</p>'))
    await body(page).evaluate((root) => {
      root.ownerDocument.getSelection = () => {
        throw new Error('Simulated editor failure')
      }
      setTimeout(() => root.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })))
    })
    await expect(
      element(page).getByRole('status').filter({ hasText: 'restarted after an error' }),
    ).toBeVisible()
    await expect(body(page).locator('p')).toHaveText('Survives a crash')
    const crash = await page.evaluate(() => window.crashes[0])
    expect(crash.recovered).toBe(true)
    expect(crash.html).toContain('Survives a crash')
    await page.getByRole('button', { name: 'Inspect form data' }).click()
    await expect(page.locator('#result')).toContainText('Survives a crash')
  })

  test('lite build edits without loading science or Word import code', async ({ page }) => {
    const requests = []
    page.on('request', (request) => requests.push(request.url()))
    await open(page, 'lite')
    const host = element(page)
    await body(page).locator('p').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Lite')
    await expect(body(page).locator('p')).toHaveText('Edit me. Lite')
    await expect(host.getByRole('button', { name: 'Math & chemistry' })).toHaveCount(0)
    await expect(host.getByRole('button', { name: 'Import Word document' })).toHaveCount(0)
    await host.getByRole('button', { name: 'Insert', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Math & chemistry' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Insert / update contents' })).toBeVisible()
    await page.keyboard.press('Escape')
    await host.evaluate((node) => node.editor.openScience())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(requests.some((url) => /editor-lite\//.test(url))).toBe(true)
    expect(requests.some((url) => /science-renderer|molecule-text|mammoth/.test(url))).toBe(false)
  })
}
