import { test, expect } from '@playwright/test'

const body = (page, index = 0) =>
  page.frameLocator('.studio-editor-frame').nth(index).locator('body')
const embed = (page, index = 0) => page.locator('.studio-editor-embed').nth(index)

test('readonly blocks editing paths and history but supports selection, search and external updates', async ({
  page,
}) => {
  await page.goto('/?mode=readonly')
  const content = body(page)
  await expect(content).toHaveAttribute('contenteditable', 'false')
  await expect(content).toHaveAttribute('aria-readonly', 'true')
  await content.focus()
  await page.keyboard.press('Control+a')
  expect(await content.evaluate((el) => el.ownerDocument.getSelection().toString())).toContain(
    'Birinci belge',
  )
  await page.keyboard.type('changed')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Control+b')
  await content.evaluate((el) => {
    for (const type of ['paste', 'drop']) {
      const data = new DataTransfer()
      data.setData('text/html', '<p>Injected</p>')
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, type === 'paste' ? 'clipboardData' : 'dataTransfer', {
        value: data,
      })
      el.dispatchEvent(event)
      if (!event.defaultPrevented) throw Error('Editing event was not blocked')
    }
  })
  await expect(content).toHaveText('Birinci belge')
  await expect(embed(page).getByRole('toolbar')).toHaveCount(0)
  await content.focus()
  await page.keyboard.press('Control+f')
  await expect(embed(page).getByRole('search')).toBeVisible()
  await expect(
    embed(page).getByRole('button', { name: 'Tümünü değiştir', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'API ile değiştir', exact: true }).click()
  await expect(content).toHaveText('API ile değişti')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(content).toHaveText('API ile değişti')
  await page.getByLabel('Salt okunur örnek', { exact: true }).uncheck()
  await expect(content).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(content).toHaveText('Birinci belge')
})

test('readonly source is inspectable and disabled closes dialogs and removes interaction', async ({
  page,
}) => {
  await page.goto('/?mode=readonly')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Kaynak kodu', exact: true })).toBeVisible()
  await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await expect(page.getByRole('button', { name: 'Değişiklikleri uygula' })).toHaveCount(0)
  // Simulate a host changing permission while its editor dialog is open.
  await page.getByLabel('Devre dışı örnek', { exact: true }).evaluate((input) => {
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(embed(page).locator('.native-editor')).toHaveAttribute('inert', '')
  await expect(body(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(embed(page).locator('iframe')).toHaveAttribute('tabindex', '-1')
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'API ile değiştir', exact: true }).click()
  await expect(body(page)).toHaveText('API ile değişti')
  await page.getByLabel('Devre dışı örnek', { exact: true }).uncheck()
  await expect(body(page)).toHaveAttribute('aria-readonly', 'true')
  await expect(body(page, 1)).toHaveAttribute('contenteditable', 'true')
})

test('placeholder stays outside HTML and locale/options update without resetting document or undo', async ({
  page,
}) => {
  await page.goto('/?empty=1')
  const content = body(page)
  await expect(content).toHaveAttribute('data-empty', 'true')
  expect(await content.evaluate((el) => getComputedStyle(el, '::before').content)).toContain(
    'İçeriğinizi',
  )
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  const original = JSON.parse(await page.locator('#document-state').textContent())
  expect(original.html).not.toContain('İçeriğinizi')
  await content.focus()
  await page.keyboard.type('Hello')
  await expect(content).toHaveAttribute('data-empty', 'false')
  await page.getByLabel('Örnek dil', { exact: true }).selectOption('en')
  await expect(embed(page).getByRole('button', { name: 'Bold', exact: true })).toBeVisible()
  await expect(embed(page, 1).getByRole('button', { name: 'Kalın', exact: true })).toBeVisible()
  await expect(content).toHaveAttribute('aria-label', 'Document content')
  expect(await content.evaluate((el) => el.ownerDocument.documentElement.lang)).toBe('en')
  await expect(content).toHaveText('Hello')
  await page.getByLabel('Sade araçlar', { exact: true }).check()
  await expect(embed(page).getByRole('button', { name: 'Font family', exact: true })).toHaveCount(0)
  await expect(embed(page).getByRole('button', { name: 'File', exact: true })).toHaveCount(0)
  await expect(embed(page).getByRole('button', { name: 'Insert', exact: true })).toBeVisible()
  await expect(embed(page).getByRole('button', { name: 'Bold', exact: true })).toBeVisible()
  await page.getByLabel('Özel metinler', { exact: true }).check()
  await expect(
    embed(page).getByRole('button', { name: '<b>Özel kalın</b>', exact: true }),
  ).toBeVisible()
  await expect(
    embed(page).getByRole('button', { name: '<b>Özel kalın</b>', exact: true }).locator('b'),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(content).toHaveAttribute('data-empty', 'true')
  await page.getByRole('button', { name: 'Belge durumunu oku', exact: true }).click()
  expect(JSON.parse(await page.locator('#document-state').textContent()).blockIds).toEqual(
    original.blockIds,
  )
  await embed(page).getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('.editor-popover')).toBeVisible()
  await page.getByLabel('Araçları gizle', { exact: true }).check()
  await expect(page.locator('.editor-popover')).toHaveCount(0)
  await expect(embed(page).getByRole('toolbar')).toHaveCount(0)
  await expect(embed(page).locator('.native-menubar')).toHaveCount(0)
  await expect(content).toHaveAttribute('contenteditable', 'true')
})

test('initial disabled state is inert and unlocking restores editing', async ({ page }) => {
  await page.goto('/?mode=disabled')
  await expect(body(page)).toHaveAttribute('contenteditable', 'false')
  await expect(embed(page).locator('.native-editor')).toHaveAttribute('inert', '')
  await page.getByLabel('Devre dışı örnek', { exact: true }).uncheck()
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await body(page).focus()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' unlocked')
  await expect(body(page)).toContainText('unlocked')
})

test('changing to readonly during a dropped-file upload prevents a late insertion', async ({
  page,
}) => {
  let pending
  await page.route('**/api/media', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    pending = route
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sunucu adaptörü örneğini aç / kapat' }).click()
  await expect(body(page, 2)).toHaveText('Sunucu medyası')
  await body(page, 2).evaluate((el) => {
    const data = new DataTransfer()
    data.items.add(new File(['test'], 'late.png', { type: 'image/png' }))
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: data })
    Object.defineProperty(event, 'clientX', { value: 40 })
    Object.defineProperty(event, 'clientY', { value: 40 })
    el.dispatchEvent(event)
  })
  await expect.poll(() => !!pending).toBe(true)
  await page.getByLabel('Salt okunur örnek', { exact: true }).check()
  await expect(body(page, 2)).toHaveAttribute('contenteditable', 'false')
  await pending
    .fulfill({
      json: { id: 'late', name: 'late.png', type: 'image/png', size: 4, url: '/late.png' },
    })
    .catch(() => {})
  await page.getByLabel('Salt okunur örnek', { exact: true }).uncheck()
  await expect(body(page, 2)).toHaveText('Sunucu medyası')
  await expect(body(page, 2).locator('img')).toHaveCount(0)
})
