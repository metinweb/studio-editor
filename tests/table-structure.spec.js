import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const cells = (page) => body(page).locator('td,th')
const simple =
  '<table><tbody><tr><td><strong>A</strong></td><td><em>B</em></td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table><p>Son</p>'
async function setup(page, html = simple) {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page, a, b) {
  await cells(page)
    .nth(a)
    .click({ position: { x: 20, y: 15 } })
  await cells(page)
    .nth(b)
    .click({ modifiers: ['Shift'], position: { x: 20, y: 15 } })
}
const quick = (page, name) =>
  page
    .getByRole('toolbar', { name: 'Tablo hızlı işlemleri' })
    .getByRole('button', { name, exact: true })
async function menu(page, name) {
  await page.locator('.native-menubar').getByRole('button', { name: 'Tablo', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}
const undo = (page) => page.getByRole('button', { name: 'Geri al', exact: true }).click()
async function grid(page) {
  return body(page)
    .locator('table')
    .evaluate((table) => {
      const result = [...table.rows].map(() => [])
      for (let y = 0; y < table.rows.length; y++) {
        let x = 0
        for (const cell of table.rows[y].cells) {
          while (result[y][x] !== undefined) x++
          for (let r = y; r < y + cell.rowSpan; r++)
            for (let c = x; c < x + cell.colSpan; c++) {
              if (!result[r] || result[r][c] !== undefined) throw Error('Invalid grid')
              result[r][c] = cell.textContent
            }
          x += cell.colSpan
        }
      }
      if (result.some((row) => row.length !== result[0].length || row.includes(undefined)))
        throw Error('Ragged grid')
      return result
    })
}
test('rectangular merge retains inline content and split preserves content in the top-left cell', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await select(page, 0, 4)
  await quick(page, 'Seçili hücreleri birleştir').click()
  await expect(cells(page).first()).toHaveAttribute('colspan', '2')
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page).first()).toHaveText('ABDE')
  await expect(cells(page).first().locator('strong')).toHaveText('A')
  await expect(cells(page).first().locator('em')).toHaveText('B')
  expect(await grid(page)).toEqual([
    ['ABDE', 'ABDE', 'C'],
    ['ABDE', 'ABDE', 'F'],
    ['G', 'H', 'I'],
  ])
  await quick(page, 'Hücreyi ayır').click()
  expect(await grid(page)).toEqual([
    ['ABDE', '', 'C'],
    ['', '', 'F'],
    ['G', 'H', 'I'],
  ])
  await undo(page)
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await undo(page)
  expect(await body(page).innerHTML()).toBe(original)
})
test('vertical merge and split work through menu and right-click tools', async ({ page }) => {
  await setup(page)
  await cells(page)
    .nth(1)
    .click({ position: { x: 20, y: 15 } })
  await menu(page, 'Alttaki hücreyle birleştir')
  await expect(cells(page).nth(1)).toHaveAttribute('rowspan', '2')
  await expect(cells(page).nth(1)).toHaveText('BE')
  await cells(page)
    .nth(1)
    .click({ button: 'right', position: { x: 20, y: 15 } })
  await page.getByRole('menuitem', { name: 'Hücreyi ayır', exact: true }).click()
  await expect(cells(page)).toHaveCount(9)
  await expect(body(page).locator('[rowspan]')).toHaveCount(0)
  expect(await grid(page)).toEqual([
    ['A', 'BE', 'C'],
    ['D', '', 'F'],
    ['G', 'H', 'I'],
  ])
})
test('insert and delete rows through a rowspan preserve spanning content', async ({ page }) => {
  await setup(
    page,
    '<table><tbody><tr><td rowspan="2"><strong>A</strong></td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td><td>H</td></tr></tbody></table><p>Son</p>',
  )
  await cells(page)
    .nth(1)
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Satır ekle').click()
  expect(await grid(page)).toEqual([
    ['A', 'B', 'C'],
    ['A', '', ''],
    ['A', 'D', 'E'],
    ['F', 'G', 'H'],
  ])
  await undo(page)
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Satırı sil').click()
  expect(await grid(page)).toEqual([
    ['A', 'D', 'E'],
    ['F', 'G', 'H'],
  ])
  await expect(cells(page).first().locator('strong')).toHaveText('A')
  await undo(page)
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
})
test('column insertion through colspan and deletion of its origin preserve a valid grid', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></tbody></table><p>Son</p>',
  )
  await cells(page)
    .nth(2)
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Sütun ekle').click()
  expect(await grid(page)).toEqual([
    ['A', 'A', 'A', 'B'],
    ['C', '', 'D', 'E'],
  ])
  await undo(page)
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Sütunu sil').click()
  expect(await grid(page)).toEqual([
    ['A', 'B'],
    ['D', 'E'],
  ])
  await undo(page)
  await expect(cells(page).first()).toHaveAttribute('colspan', '2')
})
test('row groups block cross-section merges and header deletion retains tbody', async ({
  page,
}) => {
  await setup(
    page,
    '<table><thead><tr><th scope="col">H1</th><th scope="col">H2</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p>Son</p>',
  )
  await select(page, 0, 3)
  await expect(quick(page, 'Seçili hücreleri birleştir')).toBeDisabled()
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await menu(page, 'Satır ekle')
  await expect(body(page).locator('thead tr')).toHaveCount(2)
  await expect(body(page).locator('thead tr').last().locator('th[scope=col]')).toHaveCount(2)
  await undo(page)
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Satırı sil').click()
  await expect(body(page).locator('thead')).toHaveCount(0)
  expect(await grid(page)).toEqual([
    ['A', 'B'],
    ['C', 'D'],
  ])
})
test('rowspan zero normalizes safely and Tab appends after a fully merged table', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><td rowspan="0" colspan="2">A</td></tr><tr></tr></tbody></table><p>Son</p>',
  )
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await page.keyboard.press('Tab')
  expect(await grid(page)).toEqual([
    ['A', 'A'],
    ['A', 'A'],
    ['', ''],
  ])
  await page.keyboard.insertText('Yeni')
  await expect(body(page).locator('tr').last().locator('td').first()).toHaveText('Yeni')
})
test('deleting the last logical row or column removes the table and remains undoable', async ({
  page,
}) => {
  await setup(page, '<table><tr><td colspan="2">A</td></tr></table><p>Son</p>')
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await quick(page, 'Sütunu sil').click()
  await expect(cells(page).first()).toHaveText('A')
  await quick(page, 'Sütunu sil').click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await expect(body(page)).toContainText('Son')
  await undo(page)
  await expect(cells(page).first()).toHaveText('A')
  await quick(page, 'Satırı sil').click()
  await expect(body(page).locator('table')).toHaveCount(0)
  await undo(page)
  await expect(cells(page)).toHaveCount(1)
})
test('ragged tables keep structural and merge commands disabled', async ({ page }) => {
  await setup(page, '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></table><p>Son</p>')
  await cells(page)
    .first()
    .click({ position: { x: 20, y: 15 } })
  await expect(quick(page, 'Satır ekle')).toBeDisabled()
  await expect(quick(page, 'Sütunu sil')).toBeDisabled()
  await expect(quick(page, 'Hücreyi ayır')).toBeDisabled()
})
