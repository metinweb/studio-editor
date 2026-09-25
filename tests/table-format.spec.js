import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const cells = (page) => body(page).locator('td,th')
const html =
  '<table><tbody><tr><td style="background-color:#ffe4e6"><strong>A</strong></td><td style="background-color:#dbeafe">B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table><p>Son</p>'
async function setup(page, source = html) {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(source)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page, from = 0, to = 4) {
  await cells(page)
    .nth(from)
    .click({ position: { x: 20, y: 15 } })
  await cells(page)
    .nth(to)
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
}
async function open(page) {
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Hücre biçimi', exact: true })
    .click()
  return page.getByRole('dialog', { name: 'Hücre biçimi', exact: true })
}
const apply = (dialog) =>
  dialog.getByRole('button', { name: 'Hücrelere uygula', exact: true }).click()
const undo = (page) => page.getByRole('button', { name: 'Geri al', exact: true }).click()

test('bulk fill, alignment, padding and borders affect only the rectangle and undo in one step', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await select(page)
  const dialog = await open(page)
  await expect(dialog.getByLabel('Hücre dolgusu', { exact: true })).toHaveAttribute(
    'placeholder',
    'Karışık',
  )
  await dialog.getByRole('button', { name: 'Hücre dolgusu #dcfce7', exact: true }).click()
  await expect(dialog.locator('.cell-format-preview td')).toHaveCSS(
    'background-color',
    'rgb(220, 252, 231)',
  )
  await dialog.getByRole('button', { name: 'Ortala', exact: true }).click()
  await dialog.getByRole('button', { name: 'Alta', exact: true }).click()
  await dialog.getByLabel('İç boşluk (px)', { exact: true }).fill('18')
  await dialog.getByRole('button', { name: 'Dış çerçeve', exact: true }).click()
  await dialog.getByLabel('Kalınlık (px)', { exact: true }).fill('3')
  await apply(dialog)
  await expect(dialog).toHaveCount(0)
  for (const index of [0, 1, 3, 4]) {
    await expect(cells(page).nth(index)).toHaveCSS('background-color', 'rgb(220, 252, 231)')
    await expect(cells(page).nth(index)).toHaveCSS('text-align', 'center')
    await expect(cells(page).nth(index)).toHaveCSS('vertical-align', 'bottom')
    await expect(cells(page).nth(index)).toHaveCSS('padding-top', '18px')
  }
  expect(await cells(page).nth(2).getAttribute('style')).toBeNull()
  await expect(cells(page).nth(0)).toHaveCSS('border-top-width', '3px')
  await expect(cells(page).nth(0)).toHaveCSS('border-right-style', 'none')
  await expect(cells(page).first().locator('strong')).toHaveText('A')
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
  await undo(page)
  expect(await body(page).innerHTML()).toBe(original)
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(cells(page).first()).toHaveCSS('padding-top', '18px')
})

test('mixed values are untouched, cancellation is inert and reset preserves cell structure and content', async ({
  page,
}) => {
  await setup(page)
  await select(page)
  const original = await body(page).innerHTML()
  let dialog = await open(page)
  await expect(dialog.getByRole('button', { name: 'Hücrelere uygula' })).toBeDisabled()
  await dialog.getByLabel('Hücre dolgusu', { exact: true }).fill('#000000')
  await page.keyboard.press('Escape')
  expect(await body(page).innerHTML()).toBe(original)
  dialog = await open(page)
  await dialog.getByRole('button', { name: 'Ortala', exact: true }).click()
  await apply(dialog)
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(255, 228, 230)')
  await expect(cells(page).nth(1)).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  dialog = await open(page)
  await dialog.getByRole('button', { name: 'Hücre biçimini sıfırla' }).click()
  await apply(dialog)
  expect(await cells(page).first().getAttribute('style')).toBeNull()
  await expect(cells(page).first().locator('strong')).toHaveText('A')
  await expect(cells(page)).toHaveCount(6)
  await undo(page)
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(255, 228, 230)')
})

test('merged selection uses logical edges and context menu preserves the selected rectangle', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><th rowspan="2" scope="row">A</th><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>',
  )
  await select(page, 0, 3)
  await cells(page)
    .nth(1)
    .click({ button: 'right', position: { x: 20, y: 15 } })
  await page.getByRole('menuitem', { name: 'Hücre biçimi', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Hücre biçimi', exact: true })
  await expect(dialog.locator('.cell-format-summary').first()).toContainText('3')
  await dialog.getByRole('button', { name: 'İç çizgiler', exact: true }).click()
  await apply(dialog)
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page).first()).toHaveAttribute('scope', 'row')
  await expect(cells(page).first()).toHaveCSS('border-left-style', 'none')
  await expect(cells(page).first()).toHaveCSS('border-right-style', 'solid')
  await expect(cells(page).nth(1)).toHaveCSS('border-bottom-style', 'solid')
  expect(await cells(page).nth(2).getAttribute('style')).toBeNull()
})

test('single cell formatting via menu rejects invalid values and survives source round trip', async ({
  page,
}) => {
  await setup(page)
  await cells(page)
    .nth(2)
    .click({ position: { x: 20, y: 15 } })
  await page.locator('.native-menubar').getByRole('button', { name: 'Tablo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Hücre biçimi', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Hücre biçimi', exact: true })
  await dialog.getByLabel('Hücre metin rengi', { exact: true }).fill('url(https://example.com)')
  await expect(dialog.getByRole('button', { name: 'Hücrelere uygula' })).toBeDisabled()
  await dialog.getByLabel('Hücre metin rengi', { exact: true }).fill('#123456')
  await dialog.getByLabel('İç boşluk (px)', { exact: true }).fill('99')
  await expect(dialog.getByRole('button', { name: 'Hücrelere uygula' })).toBeDisabled()
  await dialog.getByLabel('İç boşluk (px)', { exact: true }).fill('8')
  await apply(dialog)
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await expect(cells(page).nth(2)).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(cells(page).nth(2)).toHaveCSS('padding-left', '8px')
  await expect(cells(page).first()).not.toHaveCSS('color', 'rgb(18, 52, 86)')
})

test('cell formatting remains reachable on a narrow viewport with keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await select(page)
  const dialog = await open(page)
  const box = await dialog.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(391)
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await dialog.getByRole('button', { name: 'Ortala', exact: true }).focus()
  await page.keyboard.press('Space')
  await apply(dialog)
  await expect(cells(page).first()).toHaveCSS('text-align', 'center')
})
