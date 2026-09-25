import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const cells = (page) => body(page).locator('td')
const simple =
  '<table style="width:600px"><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table><p>Son</p>'
async function setup(page, html = simple) {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page, first, last) {
  await cells(page)
    .nth(first)
    .click({ position: { x: 20, y: 15 } })
  await cells(page)
    .nth(last)
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
}
async function paste(page, text, html = '') {
  await body(page).evaluate(
    (root, { text, html }) => {
      const data = new DataTransfer()
      data.setData('text/plain', text)
      data.setData('text/html', html)
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: data })
      root.dispatchEvent(event)
    },
    { text, html },
  )
}
test('shift click selects a rectangle outside HTML; delete and undo preserve table', async ({
  page,
}) => {
  await setup(page)
  await select(page, 0, 4)
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
  expect(await body(page).innerHTML()).not.toMatch(/table-multi-cell|selectedCell|cell-selection/)
  await page.keyboard.press('Delete')
  await expect(cells(page).nth(0)).toHaveText('')
  await expect(cells(page).nth(4)).toHaveText('')
  await expect(cells(page).nth(2)).toHaveText('C')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
})
test('mouse drag and keyboard extension select cells and Escape clears selection', async ({
  page,
}) => {
  await setup(page)
  const a = await cells(page).nth(0).boundingBox(),
    b = await cells(page).nth(4).boundingBox()
  await page.mouse.move(a.x + 20, a.y + 15)
  await page.mouse.down()
  await page.mouse.move(b.x + 20, b.y + 15, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
  await page.keyboard.press('Escape')
  await expect(page.locator('.table-multi-cell')).toHaveCount(0)
  await cells(page)
    .nth(0)
    .click({ position: { x: 20, y: 15 } })
  await page.keyboard.press('Alt+Shift+ArrowRight')
  await page.keyboard.press('Alt+Shift+ArrowDown')
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
})
test('TSV replaces a selected rectangle in one transaction without nested tables', async ({
  page,
}) => {
  await setup(page)
  await select(page, 0, 4)
  await paste(page, 'one\ttwo\nthree\tfour')
  await expect(cells(page)).toHaveText(['one', 'two', 'C', 'three', 'four', 'F', 'G', 'H', 'I'])
  await expect(body(page).locator('table')).toHaveCount(1)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(cells(page).nth(4)).toHaveText('four')
})
test('pasting at one cell uses logical coordinates; overflow and mismatches keep content', async ({
  page,
}) => {
  await setup(page)
  await cells(page)
    .nth(4)
    .click({ position: { x: 20, y: 15 } })
  await paste(page, '1\t2\n3\t4')
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', '1', '2', 'G', '3', '4'])
  await cells(page)
    .nth(8)
    .click({ position: { x: 20, y: 15 } })
  await paste(page, 'x\ty')
  await expect(page.getByText(/Pano verisi tabloya sığmıyor/)).toBeVisible()
  await expect(cells(page).nth(8)).toHaveText('4')
  await select(page, 0, 4)
  await paste(page, 'x\ty')
  await expect(page.getByText(/Seçili alan ile panodaki tablo boyutları eşleşmiyor/)).toBeVisible()
  await expect(cells(page).nth(0)).toHaveText('A')
})
test('merged cell footprints expand selection and matrix paste replaces the selected layout', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><td rowspan="2">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p>Son</p>',
  )
  await select(page, 0, 2)
  await expect(page.locator('.table-multi-cell')).toHaveCount(4)
  await paste(page, '1\t2\t3\n4\t5\t6')
  await expect(cells(page)).toHaveText(['1', '2', '3', '4', '5', '6'])
  await expect(body(page).locator('[rowspan],[colspan]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D'])
  await cells(page)
    .nth(2)
    .click({ position: { x: 20, y: 15 } })
  await paste(page, 'X\tY')
  await expect(cells(page)).toHaveText(['A', 'B', 'X', 'Y'])
})
test('copy and cut serialize the selected rectangle as HTML and quoted TSV', async ({ page }) => {
  await setup(page)
  await select(page, 0, 4)
  const copied = await body(page).evaluate((root) => {
    const data = new DataTransfer(),
      event = new Event('cut', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
    return { html: data.getData('text/html'), text: data.getData('text/plain') }
  })
  expect(copied.text).toBe('A\tB\nD\tE')
  expect(copied.html).toContain('<table>')
  expect(copied.html).not.toContain('>C<')
  await expect(cells(page).nth(0)).toHaveText('')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(cells(page).nth(4)).toHaveText('E')
})
test('plain text fills selected cells and Escape returns to ordinary text paste', async ({
  page,
}) => {
  await setup(page)
  await select(page, 0, 4)
  await paste(page, '')
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  await paste(page, '<safe>')
  await expect(cells(page)).toHaveText([
    '<safe>',
    '<safe>',
    'C',
    '<safe>',
    '<safe>',
    'F',
    'G',
    'H',
    'I',
  ])
  await select(page, 0, 4)
  await page.keyboard.press('Escape')
  await paste(page, 'end')
  await expect(cells(page).nth(1)).toHaveText('<safe>')
})
test('column drag keeps total width, preserves content and supports undo and cancel', async ({
  page,
}) => {
  await setup(page)
  await cells(page)
    .nth(0)
    .click({ position: { x: 20, y: 15 } })
  const width = await cells(page)
    .nth(0)
    .evaluate((el) => el.getBoundingClientRect().width)
  const handle = page.getByRole('button', { name: '1. sütun sınırını boyutlandır', exact: true })
  const box = await handle.boundingBox()
  await page.mouse.move(box.x + 4, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 44, box.y + 20, { steps: 5 })
  await page.mouse.up()
  expect(
    await cells(page)
      .nth(0)
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(width + 30)
  await expect(body(page).locator('col')).toHaveCount(3)
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('colgroup')).toHaveCount(0)
  const before = await body(page).innerHTML(),
    next = await handle.boundingBox()
  await page.mouse.move(next.x + 4, next.y + 20)
  await page.mouse.down()
  await page.mouse.move(next.x + 54, next.y + 20, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await body(page).innerHTML()).toBe(before)
})
test('column keyboard resize updates adjacent columns and survives HTML round trip', async ({
  page,
}) => {
  await setup(page)
  await cells(page)
    .nth(0)
    .click({ position: { x: 20, y: 15 } })
  const handle = page.getByRole('button', { name: '1. sütun sınırını boyutlandır', exact: true })
  await handle.focus()
  await page.keyboard.press('Shift+ArrowRight')
  const widths = await body(page)
    .locator('col')
    .evaluateAll((cols) => cols.map((col) => parseFloat(col.style.width)))
  expect(widths[0] - widths[1]).toBeGreaterThan(17)
  const html = await body(page).innerHTML()
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  expect(await body(page).innerHTML()).toBe(html)
})

test('RTL column boundaries resize in the physical arrow direction and undo', async ({ page }) => {
  await setup(page)
  await body(page)
    .locator('table')
    .evaluate((t) => (t.dir = 'rtl'))
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  const before = await cells(page).first().boundingBox()
  const handle = page.getByRole('button', { name: '1. sütun sınırını boyutlandır', exact: true })
  await handle.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  const after = await cells(page).first().boundingBox()
  expect(after.width).toBeGreaterThan(before.width + 7)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('colgroup')).toHaveCount(0)
})

test('column definitions follow insertion and deletion after resizing', async ({ page }) => {
  await setup(page)
  await cells(page)
    .nth(0)
    .click({ position: { x: 20, y: 15 } })
  const handle = page.getByRole('button', { name: '1. sütun sınırını boyutlandır', exact: true })
  const before = await body(page).innerHTML()
  await handle.click({ position: { x: 4, y: 20 } })
  expect(await body(page).innerHTML()).toBe(before)
  await handle.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Sütun ekle', exact: true })
    .click()
  await expect(body(page).locator('col')).toHaveCount(4)
  await expect(cells(page)).toHaveCount(12)
  await page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name: 'Sütunu sil', exact: true })
    .click()
  await expect(body(page).locator('col')).toHaveCount(3)
  await expect(cells(page)).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
})

test('context copy writes the selected matrix and Ctrl A exits cell selection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items) => {
          window.copied = await (await items[0].getType('text/plain')).text()
        },
        writeText: async (text) => {
          window.copied = text
        },
      },
    })
  })
  await setup(page)
  await select(page, 0, 4)
  await page.keyboard.press('Shift+F10')
  await page.getByRole('menuitem', { name: 'Kopyala', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.copied)).toBe('A\tB\nD\tE')
  await body(page).focus()
  await page.keyboard.press('Control+a')
  await expect(page.locator('.table-multi-cell')).toHaveCount(0)
})
