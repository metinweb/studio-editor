import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const cells = (page) => body(page).locator('td,th')
const target =
  '<table style="width:600px"><colgroup><col style="width:300px"><col style="width:300px"></colgroup><tbody><tr><th id="keep" scope="row" style="background-color:#dbeafe;color:#123456;width:300px;padding:7px">A</th><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'
const source =
  '<table><tr><td rowspan="2" style="background-color:#dcfce7;color:#654321;text-align:center;vertical-align:bottom;padding:13px;border-top:3px dashed #ff0000;border-left:2px dotted #0000ff;font-weight:700;width:9999px;height:9999px">X</td><td>Y</td></tr><tr><td>Z</td></tr></table>'
async function setup(page) {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(target)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
}
async function menu(page, label, name = 'Tablo') {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: label, exact: true }).click()
}
async function paste(page, html = source, text = '') {
  await body(page).evaluate(
    (root, data) => {
      const clipboard = new DataTransfer(),
        e = new Event('paste', { bubbles: true, cancelable: true })
      clipboard.setData('text/html', data.html)
      clipboard.setData('text/plain', data.text)
      Object.defineProperty(e, 'clipboardData', { value: clipboard })
      root.dispatchEvent(e)
    },
    { html, text },
  )
}
const undo = (page) => page.getByRole('button', { name: 'Geri al', exact: true }).click()
test('source cell presentation transfers with spans while destination geometry and semantics survive one undo', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await menu(page, 'Tablo yapıştır: kaynak hücre biçimini kullan')
  await paste(page)
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page).first()).toHaveAttribute('id', 'keep')
  await expect(cells(page).first()).toHaveAttribute('scope', 'row')
  await expect(body(page).locator('th')).toHaveCount(1)
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(220, 252, 231)')
  await expect(cells(page).first()).toHaveCSS('color', 'rgb(101, 67, 33)')
  await expect(cells(page).first()).toHaveCSS('text-align', 'center')
  await expect(cells(page).first()).toHaveCSS('vertical-align', 'bottom')
  await expect(cells(page).first()).toHaveCSS('border-top-style', 'dashed')
  await expect(cells(page).first()).toHaveCSS('border-left-style', 'dotted')
  await expect(cells(page).first()).toHaveCSS('padding-left', '13px')
  expect(
    await cells(page)
      .first()
      .evaluate((n) => n.style.width),
  ).toBe('300px')
  expect(
    await cells(page)
      .first()
      .evaluate((n) => n.style.height),
  ).toBe('')
  await expect(body(page).locator('col')).toHaveCount(2)
  await undo(page)
  expect(await body(page).innerHTML()).toBe(original)
  await menu(page, 'Tablo yapıştır: hedef biçimini koru')
  await paste(page)
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
})

test('single source cell style broadcasts, replaces missing properties and converts legacy presentation', async ({
  page,
}) => {
  await setup(page)
  await cells(page)
    .last()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
  await menu(page, 'Tablo yapıştır: kaynak hücre biçimini kullan')
  await paste(
    page,
    '<table><tr><td bgcolor="#fef3c7" align="right" valign="bottom">Legacy</td></tr></table>',
  )
  await expect(cells(page)).toHaveText(['Legacy', 'Legacy', 'Legacy', 'Legacy'])
  for (let i = 0; i < 4; i++) {
    await expect(cells(page).nth(i)).toHaveCSS('background-color', 'rgb(254, 243, 199)')
    await expect(cells(page).nth(i)).toHaveCSS('text-align', 'right')
    await expect(cells(page).nth(i)).toHaveCSS('vertical-align', 'bottom')
  }
  expect(
    await cells(page)
      .first()
      .evaluate((n) => n.style.padding),
  ).toBe('')
  expect(
    await cells(page)
      .first()
      .evaluate((n) => n.style.color),
  ).toBe('')
  await paste(page, '<table><tr><td>Plain</td></tr></table>')
  expect(
    await cells(page)
      .first()
      .evaluate((n) => n.style.backgroundColor),
  ).toBe('')
})

test('clean, text and TSV do not replace target cell formatting even when source option is selected', async ({
  page,
}) => {
  await setup(page)
  await menu(page, 'Tablo yapıştır: kaynak hücre biçimini kullan')
  await menu(page, 'Yapıştır: biçimi temizle', 'Düzenle')
  await paste(page)
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  await undo(page)
  await menu(page, 'Yapıştır: biçimi koru', 'Düzenle')
  await paste(page, '', '1\t2\n3\t4')
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  await undo(page)
  await cells(page)
    .last()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
  await menu(page, 'Yapıştır: yalnızca metin', 'Düzenle')
  await paste(page, source, 'Text')
  await expect(cells(page)).toHaveText(['Text', 'Text', 'Text', 'Text'])
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
})

test('clipboard round trip preserves individual borders and padding without importing unsafe style or priority', async ({
  page,
}) => {
  await setup(page)
  await menu(page, 'Tablo yapıştır: kaynak hücre biçimini kullan')
  await paste(
    page,
    '<table><tr><td style="border-top:3px dashed #ff0000;padding-left:19px;background-color:#dcfce7 !important;position:fixed;background-image:url(https://example.invalid/image);color:var(--foreign);border-image:url(https://example.invalid/image) 1">Safe</td></tr></table>',
  )
  const cell = cells(page).first()
  await expect(cell).toHaveCSS('border-top-style', 'dashed')
  await expect(cell).toHaveCSS('padding-left', '19px')
  expect(await cell.evaluate((n) => n.style.getPropertyPriority('background-color'))).toBe('')
  expect(await cell.getAttribute('style')).not.toMatch(/url\(|var\(|position|important/)
  await cells(page)
    .first()
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
  const copied = await body(page).evaluate((root) => {
    const data = new DataTransfer(),
      e = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'clipboardData', { value: data })
    root.dispatchEvent(e)
    return data.getData('text/html')
  })
  await cells(page)
    .last()
    .click({ position: { x: 20, y: 15 } })
  await paste(page, copied)
  await expect(cells(page).last()).toHaveCSS('padding-left', '19px')
  await expect(cells(page).last()).toHaveCSS('border-top-style', 'dashed')
})
