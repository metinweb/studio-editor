import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tableGrid } from '../../src/editor/table-grid.js'
import { planTableEdit } from '../../src/editor/table-operations.js'
function modelOf(entries, height) {
  const section = {},
    rows = Array.from({ length: height }, () => ({ cells: [], parentElement: section }))
  for (const e of entries.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const cell = { name: e.name, colSpan: e.w || 1, rowSpan: e.h ?? 1, parentElement: rows[e.y] }
    rows[e.y].cells.push(cell)
  }
  return tableGrid({ rows })
}
function assertCoverage(plan) {
  if (plan.removeTable) return
  const occupied = new Set()
  for (const e of plan.entries)
    for (let y = e.y; y < e.y + e.h; y++)
      for (let x = e.x; x < e.x + e.w; x++) {
        assert.ok(x >= 0 && y >= 0 && x < plan.width && y < plan.height)
        const key = `${x}:${y}`
        assert.ok(!occupied.has(key), `overlap ${key}`)
        occupied.add(key)
      }
  assert.equal(occupied.size, plan.width * plan.height)
}
test('deleting a rowspan origin preserves its cell and shifts it into the remaining row', () => {
  const model = modelOf(
    [
      { name: 'A', x: 0, y: 0, h: 2 },
      { name: 'B', x: 1, y: 0 },
      { name: 'C', x: 1, y: 1 },
    ],
    2,
  )
  const cell = model.grid[0][0],
    plan = planTableEdit(model, cell, 'deleteRow')
  assertCoverage(plan)
  assert.deepEqual(
    plan.entries.find((e) => e.cell === cell),
    { cell, x: 0, y: 0, w: 1, h: 1 },
  )
  assert.deepEqual(
    plan.entries.map((e) => e.cell?.name),
    ['A', 'C'],
  )
})
test('all axes preserve rectangular coverage over varied merged layouts', () => {
  for (let width = 1; width <= 8; width++)
    for (let height = 1; height <= 8; height++) {
      const w = Math.ceil(width / 2),
        h = Math.ceil(height / 2),
        entries = [{ name: 'merged', x: 0, y: 0, w, h }]
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (x >= w || y >= h) entries.push({ name: `${x}:${y}`, x, y })
      const model = modelOf(entries, height)
      for (const cell of model.positions.keys())
        for (const command of [
          'addRow',
          'addRowBefore',
          'appendRow',
          'deleteRow',
          'addColumn',
          'addColumnBefore',
          'deleteColumn',
        ]) {
          const plan = planTableEdit(model, cell, command)
          assert.ok(plan)
          assertCoverage(plan)
          if (!command.startsWith('delete'))
            for (const original of model.positions.keys())
              assert.ok(plan.entries.some((e) => e.cell === original))
        }
    }
})
test('rowspan zero grows within its group but Tab append creates an editable row', () => {
  const model = modelOf([{ name: 'A', x: 0, y: 0, w: 2, h: 0 }], 2),
    cell = model.grid[0][0]
  const inserted = planTableEdit(model, cell, 'addRow')
  assertCoverage(inserted)
  assert.equal(inserted.entries[0].h, 3)
  const appended = planTableEdit(model, cell, 'appendRow')
  assertCoverage(appended)
  assert.equal(appended.entries.filter((e) => !e.cell).length, 2)
})
test('dimension limits reject expansion before changing any cells', () => {
  const model = modelOf([{ name: 'wide', x: 0, y: 0, w: 100 }], 1)
  assert.equal(planTableEdit(model, model.grid[0][0], 'addColumn'), null)
  assert.equal(model.grid[0][0].colSpan, 100)
})
