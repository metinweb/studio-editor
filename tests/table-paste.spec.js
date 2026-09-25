import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const cells = (page) => body(page).locator('td,th')
const simple =
  '<table style="width:600px"><colgroup><col style="width:200px"><col style="width:200px"><col style="width:200px"></colgroup><tbody><tr><td style="background-color:#dbeafe">A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table><p>Son</p>'
const merged =
  '<table><tbody><tr><td rowspan="2"><strong>X</strong></td><td>Y</td></tr><tr><td><em>Z</em></td></tr></tbody></table>'
async function setup(page, html = simple) {
  await page.goto('/')
  await expect(body(page)).toHaveAttribute('contenteditable', 'true')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function click(page, index, shift = false) {
  await cells(page)
    .nth(index)
    .click({ modifiers: shift ? ['Shift'] : [], position: { x: 20, y: 15 } })
}
async function paste(page, html, text = '') {
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
const undo = (page) => page.getByRole('button', { name: 'Geri al', exact: true }).click()
async function matrix(page) {
  return body(page)
    .locator('table')
    .first()
    .evaluate((table) => {
      const grid = [...table.rows].map(() => [])
      for (const [y, row] of [...table.rows].entries()) {
        let x = 0
        for (const cell of row.cells) {
          while (grid[y][x] !== undefined) x++
          const h =
            cell.rowSpan ||
            [...table.rows].filter((r) => r.parentElement === row.parentElement).length -
              row.sectionRowIndex
          for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < cell.colSpan; dx++) {
              if (!grid[y + dy] || grid[y + dy][x + dx] !== undefined) throw Error('Overlap')
              grid[y + dy][x + dx] = cell.textContent
            }
          x += cell.colSpan
        }
      }
      if (
        grid.some((r) => r.length !== grid[0].length || Array.from(r).some((v) => v === undefined))
      )
        throw Error('Ragged grid')
      return grid
    })
}

test('merged HTML replaces a rectangle, keeps target style and columns, and restores exact HTML on undo', async ({
  page,
}) => {
  await setup(page)
  const original = await body(page).innerHTML()
  await click(page, 0)
  await click(page, 4, true)
  await paste(page, merged)
  expect(await matrix(page)).toEqual([
    ['X', 'Y', 'C'],
    ['X', 'Z', 'F'],
    ['G', 'H', 'I'],
  ])
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page).first()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  await expect(cells(page).first().locator('strong')).toHaveText('X')
  await expect(body(page).locator('em')).toHaveText('Z')
  await expect(body(page).locator('col')).toHaveCount(3)
  await expect(body(page).locator('table')).toHaveCount(1)
  await undo(page)
  expect(await body(page).innerHTML()).toBe(original)
  await page.getByRole('button', { name: 'Yinele', exact: true }).click()
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
})

test('plain matrix splits a fully covered merged target without duplicating ids or losing inherited style', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><th id="heading" scope="row" colspan="2" rowspan="2" style="background-color:#dbeafe">Old</th><td>C</td></tr><tr><td>F</td></tr></tbody></table>',
  )
  const original = await body(page).innerHTML()
  await click(page, 0)
  await paste(page, '', '1\t2\n3\t4')
  expect(await matrix(page)).toEqual([
    ['1', '2', 'C'],
    ['3', '4', 'F'],
  ])
  await expect(body(page).locator('th')).toHaveCount(4)
  await expect(body(page).locator('#heading')).toHaveCount(1)
  await expect(body(page).locator('th').last()).toHaveCSS('background-color', 'rgb(219, 234, 254)')
  await expect(body(page).locator('[rowspan],[colspan]')).toHaveCount(0)
  await undo(page)
  expect(await body(page).innerHTML()).toBe(original)
})

test('partial merged target and overflow are rejected without adding an undo step', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><td>A</td><td rowspan="2">B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table><p>Son</p>',
  )
  const original = await body(page).innerHTML()
  await click(page, 0)
  await paste(page, '', 'x\ty')
  await expect(page.getByText(/yalnızca bir bölümünü kapsıyor/)).toBeVisible()
  expect(await body(page).innerHTML()).toBe(original)
  await click(page, 4)
  await paste(page, merged)
  await expect(page.getByText(/Pano verisi tabloya sığmıyor/)).toBeVisible()
  expect(await body(page).innerHTML()).toBe(original)
  // Only the setup source change exists in history.
  await undo(page)
  expect(await body(page).innerHTML()).not.toBe(original)
})

test('source merges cannot cross target row groups but separate source cells can', async ({
  page,
}) => {
  await setup(
    page,
    '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>C</td><td>D</td></tr></tbody></table>',
  )
  const original = await body(page).innerHTML()
  await click(page, 0)
  await click(page, 3, true)
  await paste(page, merged)
  await expect(page.getByText(/tablo başlığı veya gövdesi sınırını aşıyor/)).toBeVisible()
  expect(await body(page).innerHTML()).toBe(original)
  await paste(
    page,
    '<table><tr><td colspan="2">Header</td></tr><tr><td>C1</td><td>D1</td></tr></table>',
  )
  await expect(body(page).locator('thead th')).toHaveText('Header')
  await expect(body(page).locator('thead th')).toHaveAttribute('colspan', '2')
  await expect(body(page).locator('tbody td')).toHaveText(['C1', 'D1'])
})

test('copied merged HTML round trips while TSV places empty values in covered slots', async ({
  page,
}) => {
  await setup(page, merged + '<p>Son</p>')
  await click(page, 0)
  await click(page, 2, true)
  const copied = await body(page).evaluate((root) => {
    const data = new DataTransfer(),
      event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
    return { html: data.getData('text/html'), text: data.getData('text/plain') }
  })
  expect(copied.text).toBe('X\tY\n\tZ')
  expect(copied.html).toContain('rowspan="2"')
  // TSV removes spans in the fully covered destination; the HTML restores them.
  await paste(page, '', '1\t2\n3\t4')
  await click(page, 0)
  await click(page, 3, true)
  await paste(page, copied.html, copied.text)
  expect(await matrix(page)).toEqual([
    ['X', 'Y'],
    ['X', 'Z'],
  ])
  await expect(cells(page)).toHaveCount(3)
})

test('rowspan zero is normalized in source while outside destination spans remain untouched', async ({
  page,
}) => {
  await setup(
    page,
    '<table><tbody><tr><td>A</td><td>B</td><td rowspan="0">Outside</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>',
  )
  await click(page, 0)
  await paste(
    page,
    '<table><tbody><tr><td rowspan="0" colspan="2">All</td></tr><tr></tr></tbody></table>',
  )
  expect(await matrix(page)).toEqual([
    ['All', 'All', 'Outside'],
    ['All', 'All', 'Outside'],
  ])
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page).last()).toHaveAttribute('rowspan', '0')
})

test('single source value fills a merged cell or selected merged cells without changing structure', async ({
  page,
}) => {
  await setup(page, merged)
  await click(page, 0)
  await paste(page, '<table><tr><td>One</td></tr></table>')
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
  await expect(cells(page)).toHaveText(['One', 'Y', 'Z'])
  await click(page, 0)
  await click(page, 2, true)
  await paste(page, '<table><tr><td>All</td></tr></table>')
  await expect(cells(page)).toHaveText(['All', 'All', 'All'])
  await expect(cells(page).first()).toHaveAttribute('rowspan', '2')
})

test('malformed, nested and mixed source tables are rejected; valid merged HTML is sanitized', async ({
  page,
}) => {
  await setup(page)
  await click(page, 0)
  const original = await body(page).innerHTML()
  for (const source of [
    '<table><tr><td colspan="2">A</td></tr><tr><td>B</td></tr></table>',
    '<table><tr><td><table><tr><td>Nested</td></tr></table></td></tr></table>',
    '<p>Extra content</p>' + merged,
  ]) {
    await paste(page, source)
    expect(await body(page).innerHTML()).toBe(original)
  }
  await paste(
    page,
    '<table><tr><td colspan="2"><script>window.pwned=1</script><a href="javascript:alert(1)" onclick="alert(1)">Safe</a></td></tr></table>',
  )
  await expect(cells(page).first()).toHaveAttribute('colspan', '2')
  await expect(cells(page).first()).toHaveText('Safe')
  await expect(body(page).locator('script,[onclick],[href^="javascript:"]')).toHaveCount(0)
})
