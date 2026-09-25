import { test, expect } from '@playwright/test'
const body = (page, index = 0) =>
  page.frameLocator('.studio-editor-frame').nth(index).locator('body')
const source =
  '<meta name="Generator" content="Microsoft Excel"><!--StartFragment--><table><tbody><tr><td colspan="2" rowspan="2" style="background-color:#ff0000"><strong>Excel</strong></td></tr><tr></tr></tbody></table><!--EndFragment-->'
async function setup(page) {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      '<table><tbody><tr><td style="background-color:#dbeafe">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p>Son</p>',
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page) {
  await body(page)
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  await body(page)
    .locator('td')
    .last()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
}
async function paste(page, html = source, text = 'Excel') {
  await body(page).evaluate(
    (root, { html, text }) => {
      const data = new DataTransfer(),
        event = new Event('paste', { bubbles: true, cancelable: true })
      data.setData('text/html', html)
      data.setData('text/plain', text)
      Object.defineProperty(event, 'clipboardData', { value: data })
      root.dispatchEvent(event)
    },
    { html, text },
  )
}
for (const mode of ['keep', 'clean']) {
  test(`installed package preserves Excel spans and logical metadata in ${mode} mode`, async ({
    page,
  }) => {
    await setup(page)
    const original = await body(page).innerHTML()
    await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption(mode)
    await select(page)
    await paste(page)
    await expect(body(page).locator('td')).toHaveCount(1)
    await expect(body(page).locator('td')).toHaveAttribute('rowspan', '2')
    await expect(body(page).locator('td')).toHaveAttribute('colspan', '2')
    await expect(body(page).locator('td')).toHaveCSS('background-color', 'rgb(219, 234, 254)')
    await expect(body(page).locator('strong')).toHaveCount(mode === 'keep' ? 1 : 0)
    expect(JSON.parse(await page.locator('#paste-info').textContent())).toMatchObject({
      source: 'excel',
      mode,
      rows: 2,
      columns: 2,
      inserted: true,
      warnings: [],
    })
    expect(JSON.parse(await page.locator('#transaction').textContent()).kind).toBe('pasteCells')
    await expect(body(page, 1)).toHaveText('İkinci belge')
    await page.getByRole('button', { name: 'API geri al', exact: true }).click()
    expect(await body(page).innerHTML()).toBe(original)
    // Failed clipping keeps both content and the last published transaction unchanged.
    await body(page)
      .locator('td')
      .last()
      .click({ position: { x: 20, y: 15 } })
    const transaction = await page.locator('#transaction').textContent()
    await paste(page)
    expect(JSON.parse(await page.locator('#paste-info').textContent()).inserted).toBe(false)
    expect(await page.locator('#transaction').textContent()).toBe(transaction)
    expect(await body(page).innerHTML()).toBe(original)
  })
}

test('text-only mode ignores merge markup and readonly blocks merged pastes', async ({ page }) => {
  await setup(page)
  await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption('text')
  await select(page)
  await paste(page)
  await expect(body(page).locator('td')).toHaveText(['Excel', 'Excel', 'Excel', 'Excel'])
  await expect(body(page).locator('[colspan],[rowspan]')).toHaveCount(0)
  const before = await body(page).innerHTML()
  await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption('keep')
  await page.getByLabel('Salt okunur örnek', { exact: true }).check()
  await paste(page)
  expect(await body(page).innerHTML()).toBe(before)
})

test('table paste style v-model is reactive, menu changes emit and instances stay independent', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await page.getByLabel('Tablo yapıştırma biçimi', { exact: true }).selectOption('source')
  await select(page)
  await paste(page)
  await expect(body(page).locator('td')).toHaveCSS('background-color', 'rgb(255, 0, 0)')
  expect(JSON.parse(await page.locator('#transaction').textContent()).kind).toBe('pasteCells')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  expect(await body(page).innerHTML()).toBe(original)
  await page.getByLabel('Örnek dil', { exact: true }).selectOption('en')
  await page
    .locator('.studio-editor-embed')
    .first()
    .locator('.native-menubar')
    .getByRole('button', { name: 'Table', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Table paste: keep destination formatting', exact: true })
    .click()
  await expect(page.getByLabel('Tablo yapıştırma biçimi', { exact: true })).toHaveValue('target')
  await select(page)
  await paste(page)
  await expect(body(page).locator('td')).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  await page
    .locator('.studio-editor-embed')
    .nth(1)
    .locator('.native-menubar')
    .getByRole('button', { name: 'Tablo', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Tablo yapıştır: kaynak hücre biçimini kullan', exact: true })
    .click()
  await expect(page.getByLabel('Tablo yapıştırma biçimi', { exact: true })).toHaveValue('target')
  await expect(body(page, 1)).toHaveText('İkinci belge')
})

test('source cell formatting respects clean mode and a readonly permission change', async ({
  page,
}) => {
  await setup(page)
  await page.getByLabel('Tablo yapıştırma biçimi', { exact: true }).selectOption('source')
  await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption('clean')
  await select(page)
  await paste(page)
  await expect(body(page).locator('td')).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  const before = await body(page).innerHTML()
  await page.getByLabel('Yapıştırma modu', { exact: true }).selectOption('keep')
  await page.getByLabel('Salt okunur örnek', { exact: true }).check()
  await paste(page)
  expect(await body(page).innerHTML()).toBe(before)
})
