import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').first().locator('body')
async function setup(page) {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Kaynağı aç', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      '<table style="width:400px"><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p>Son</p>',
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
test('installed component matrix paste emits one transaction and leaves other editor untouched', async ({
  page,
}) => {
  await setup(page)
  await body(page)
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  await body(page)
    .locator('td')
    .last()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
  await body(page).evaluate((root) => {
    const data = new DataTransfer()
    data.setData('text/plain', '1\t2\n3\t4')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
  })
  await expect(body(page).locator('td')).toHaveText(['1', '2', '3', '4'])
  await expect(page.locator('#second-content')).toContainText('İkinci belge')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(body(page).locator('td')).toHaveText(['A', 'B', 'C', 'D'])
})
test('readonly cancels a live column resize and clears the cell overlay', async ({ page }) => {
  await setup(page)
  await body(page)
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  const before = await body(page).innerHTML()
  const handle = page.getByRole('button', { name: '1. sütun sınırını boyutlandır', exact: true })
  const box = await handle.boundingBox()
  await page.mouse.move(box.x + 4, box.y + 15)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 15, { steps: 5 })
  await page.getByLabel('Salt okunur örnek', { exact: true }).evaluate((input) => {
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.mouse.up()
  await expect(body(page)).toHaveAttribute('contenteditable', 'false')
  expect(await body(page).innerHTML()).toBe(before)
  await expect(handle).toHaveCount(0)
  await page.getByLabel('Salt okunur örnek', { exact: true }).uncheck()
  expect(await body(page).innerHTML()).toBe(before)
})

test('installed package merges, splits and edits spans with isolated undo transactions', async ({
  page,
}) => {
  await setup(page)
  const content = body(page),
    original = await content.innerHTML()
  await content
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  await content
    .locator('td')
    .last()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Seçili hücreleri birleştir', exact: true })
    .click()
  await expect(content.locator('td')).toHaveCount(1)
  await expect(content.locator('td')).toHaveAttribute('rowspan', '2')
  expect(JSON.parse(await page.locator('#transaction').textContent()).kind).toBe('mergeCells')
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Satırı sil', exact: true })
    .click()
  await expect(content.locator('td')).toHaveText('ABCD')
  await expect(content.locator('tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await expect(content.locator('td')).toHaveAttribute('rowspan', '2')
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Hücreyi ayır', exact: true })
    .click()
  await expect(content.locator('td')).toHaveText(['ABCD', '', '', ''])
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  expect(await content.innerHTML()).toBe(original)
  await expect(page.locator('#second-content')).toContainText('İkinci belge')
})

test('cell formatting emits one isolated transaction and stale dialogs cannot edit a replaced document', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  const open = async () => {
    await body(page)
      .locator('td')
      .first()
      .click({ position: { x: 20, y: 15 } })
    await body(page)
      .locator('td')
      .last()
      .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
    await page
      .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
      .getByRole('button', { name: 'Hücre biçimi', exact: true })
      .click()
    return page.getByRole('dialog', { name: 'Hücre biçimi', exact: true })
  }
  let dialog = await open()
  await dialog.getByRole('button', { name: 'Hücre dolgusu #dcfce7', exact: true }).click()
  await dialog.getByRole('button', { name: 'Hücrelere uygula' }).click()
  expect(JSON.parse(await page.locator('#transaction').textContent()).kind).toBe('formatCells')
  await expect(body(page).locator('td').last()).toHaveCSS('background-color', 'rgb(220, 252, 231)')
  await expect(page.locator('#second-content')).toContainText('İkinci belge')
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  expect(await body(page).innerHTML()).toBe(original)
  dialog = await open()
  await dialog.getByRole('button', { name: 'Ortala', exact: true }).click()
  // The host may replace v-model while a native modal is open.
  await page
    .getByRole('button', { name: 'API ile değiştir', exact: true })
    .evaluate((button) => button.click())
  await dialog.getByRole('button', { name: 'Hücrelere uygula' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Belge değişti')
  await expect(body(page)).toHaveText('API ile değişti')
  await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await page.getByRole('button', { name: 'API geri al', exact: true }).click()
  expect(await body(page).innerHTML()).toBe(original)
})

test('readonly closes a pending cell draft without changing the document', async ({ page }) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await body(page)
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Hücre biçimi', exact: true })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ortala', exact: true }).click()
  await page.getByLabel('Salt okunur örnek', { exact: true }).evaluate((input) => {
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(body(page)).toHaveAttribute('contenteditable', 'false')
  expect(await body(page).innerHTML()).toBe(original)
  await page.getByLabel('Salt okunur örnek', { exact: true }).uncheck()
  await page.getByLabel('Örnek dil', { exact: true }).selectOption('en')
  await body(page)
    .locator('td')
    .first()
    .click({ position: { x: 20, y: 15 } })
  await page.getByRole('button', { name: 'Cell formatting', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cell formatting', exact: true })
  await dialog.getByRole('button', { name: 'Cell fill #dbeafe', exact: true }).click()
  await expect(dialog.locator('.cell-format-preview td')).toHaveCSS(
    'background-color',
    'rgb(219, 234, 254)',
  )
  await dialog.getByRole('button', { name: 'Apply to cells', exact: true }).click()
  await expect(body(page).locator('td').first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
})
