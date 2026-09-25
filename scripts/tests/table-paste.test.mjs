import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tableGrid } from '../../src/editor/table-grid.js'
import { planTablePaste } from '../../src/editor/table-paste.js'

function model(width, height, w = 1, h = 1) {
  const section = {},
    rows = Array.from({ length: height }, () => ({ cells: [], parentElement: section }))
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (x >= w || y >= h || (x === 0 && y === 0))
        rows[y].cells.push({
          colSpan: x === 0 && y === 0 ? w : 1,
          rowSpan: x === 0 && y === 0 ? h : 1,
          parentElement: rows[y],
        })
  return tableGrid({ rows })
}
test('merged paste plans cover each destination slot once and retain outside cells', () => {
  for (let width = 1; width <= 6; width++)
    for (let height = 1; height <= 6; height++)
      for (const [w, h] of [
        [1, 1],
        [width, height],
        [width, 1],
        [1, height],
      ]) {
        const target = model(width + 1, height + 1)
        const source = model(width, height, w, h)
        const plan = planTablePaste(target, source, 1, 1)
        assert.equal(plan.error, undefined)
        const occupied = new Set()
        for (const e of plan.entries) {
          for (let y = e.y; y < e.y + e.h; y++)
            for (let x = e.x; x < e.x + e.w; x++) {
              const key = `${x}:${y}`
              assert.equal(occupied.has(key), false)
              occupied.add(key)
            }
        }
        assert.equal(occupied.size, target.width * target.height)
        for (const cell of target.grid[0])
          assert.ok(plan.entries.some((e) => e.cell === cell && e.unchanged))
      }
})
test('splitting a covered target reuses only the original origin and inherits other cells from it', () => {
  const target = model(2, 2, 2, 2),
    source = model(2, 2)
  const plan = planTablePaste(target, source, 0, 0)
  assert.equal(plan.entries.filter((e) => e.cell).length, 1)
  assert.equal(plan.entries[0].cell, target.grid[0][0])
  assert.ok(plan.entries.every((e) => e.template === target.grid[0][0]))
})
test('boundary, overflow and target section crossings are rejected without modifying either model', () => {
  const target = model(3, 3, 2, 2),
    source = model(2, 2)
  assert.equal(planTablePaste(target, source, 1, 1).error, 'boundary')
  assert.equal(planTablePaste(target, source, 2, 2).error, 'overflow')
  assert.equal(target.grid[0][0].rowSpan, 2)
  const grouped = model(2, 2),
    merged = model(2, 2, 2, 2)
  grouped.rows[1].parentElement = {}
  assert.equal(planTablePaste(grouped, merged, 0, 0).error, 'section')
  assert.equal(merged.grid[0][0].rowSpan, 2)
})
