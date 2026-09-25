import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tableGrid, cellRectangle } from '../../src/editor/table-grid.js'
const cell = (colSpan = 1, rowSpan = 1) => ({ colSpan, rowSpan })
function table(rows) {
  const parentElement = {}
  return { rows: rows.map((cells) => ({ cells, parentElement })) }
}
test('logical coordinates include rowspans and colspans', () => {
  const a = cell(1, 2),
    b = cell(2),
    c = cell(),
    d = cell()
  const model = tableGrid(
    table([
      [a, b],
      [c, d],
    ]),
  )
  assert.deepEqual(model.grid, [
    [a, b, b],
    [a, c, d],
  ])
  assert.deepEqual(model.positions.get(d), { x: 2, y: 1, w: 1, h: 1 })
  const selected = cellRectangle(model, b, c)
  assert.deepEqual([selected.left, selected.right, selected.top, selected.bottom], [1, 3, 0, 2])
  assert.deepEqual(selected.cells, [b, c, d])
})
test('selection expands transitively without slicing merged cells', () => {
  const a = cell(1, 2),
    b = cell(2),
    c = cell(),
    d = cell()
  const model = tableGrid(
    table([
      [a, b],
      [c, d],
    ]),
  )
  assert.equal(cellRectangle(model, a, c).cells.length, 4)
})
test('ragged, overlapping and excessive spans are rejected', () => {
  assert.equal(tableGrid(table([[cell(), cell()], [cell()]])), null)
  assert.equal(tableGrid(table([[cell(), cell(1, 2)], [cell(2)]])), null)
  assert.equal(tableGrid(table([[cell(101)]])), null)
  assert.equal(tableGrid(table([[cell(1, 2)]])), null)
})
test('zero rowspan extends to the row group only', () => {
  const a = cell(1, 0),
    model = tableGrid(table([[a, cell()], [cell()]]))
  assert.equal(model.positions.get(a).h, 2)
  const mixed = table([[cell(1, 2)], [cell()]])
  mixed.rows[1].parentElement = {}
  assert.equal(tableGrid(mixed), null)
})
