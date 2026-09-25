import { tableGrid, cellRectangle } from './table-grid.js'
import { planTableEdit, applyTableEdit, writeCells } from './table-operations.js'
import { caretInside, caretAfter } from './selection'

function sameSection(selection) {
  return (
    selection?.cells.length > 1 &&
    new Set(selection.cells.map((cell) => cell.parentElement.parentElement)).size === 1
  )
}
export const tableStructure = {
  tableCapabilities(model, selection) {
    const cell = this.context()?.closest('td,th')
    model ||= tableGrid(cell?.closest('table'))
    const p = model?.positions.get(cell)
    const right = p && model.grid[p.y][p.x + p.w],
      down = p && model.grid[p.y + p.h]?.[p.x]
    const r = model?.positions.get(right),
      d = model?.positions.get(down)
    return {
      canEditTable: !!model,
      canMergeCells: sameSection(selection || this.selectedCells(model)),
      canMergeRight: !!r && r.y === p.y && r.h === p.h,
      canMergeDown:
        !!d &&
        d.x === p.x &&
        d.w === p.w &&
        down.parentElement.parentElement === cell.parentElement.parentElement,
      canSplitCell: !!p && (p.w > 1 || p.h > 1),
    }
  },
  table(command) {
    this.transaction(() => {
      const cell = this.context()?.closest('td,th'),
        table = cell?.closest('table')
      if (!table) return
      if (command === 'deleteTable') {
        caretAfter(this.root, table)
        table.remove()
        return
      }
      const model = tableGrid(table),
        plan = planTableEdit(model, cell, command)
      if (!plan) {
        this.callbacks.onNotice('Tablo yapısı veya boyut sınırı bu işleme izin vermiyor.')
        return
      }
      if (plan.removeTable) {
        caretAfter(this.root, table)
        table.remove()
        return
      }
      const focus = applyTableEdit(model, cell, plan)
      if (!plan.row)
        this.updateColumnDefinitions(table, command === 'addColumn' ? plan.k - 1 : plan.k, command)
      caretInside(this.root, focus)
    }, command)
  },
  mergeCells(direction) {
    if (!this.editable) return
    let selection = this.selectedCells()
    if (direction) {
      const cell = this.context()?.closest('td,th'),
        model = tableGrid(cell?.closest('table')),
        p = model?.positions.get(cell)
      const capabilities = this.tableCapabilities()
      if (!p || !(direction === 'right' ? capabilities.canMergeRight : capabilities.canMergeDown))
        return
      const next = direction === 'right' ? model.grid[p.y][p.x + p.w] : model.grid[p.y + p.h][p.x]
      selection = cellRectangle(model, cell, next)
    }
    if (!sameSection(selection)) return
    this.transaction(() => {
      const { model, left, right, top, bottom, cells } = selection
      const first = model.grid[top][left]
      for (const cell of cells)
        if (cell !== first) {
          if (first.childNodes.length && cell.childNodes.length)
            first.append(this.doc.createElement('br'))
          first.append(...cell.childNodes)
        }
      const removed = new Set(cells.filter((cell) => cell !== first))
      const entries = [...model.positions]
        .filter(([cell]) => !removed.has(cell))
        .map(([cell, p]) => ({ cell, ...p }))
      Object.assign(
        entries.find((e) => e.cell === first),
        { x: left, y: top, w: right - left, h: bottom - top },
      )
      writeCells(model.table, entries)
      caretInside(this.root, first)
    }, 'mergeCells')
  },
  mergeCellRight() {
    this.mergeCells('right')
  },
  mergeCellDown() {
    this.mergeCells('down')
  },
  splitCell() {
    if (!this.editable) return
    const cell = this.context()?.closest('td,th'),
      model = tableGrid(cell?.closest('table')),
      p = model?.positions.get(cell)
    if (!p || (p.w === 1 && p.h === 1)) return
    this.transaction(() => {
      const entries = [...model.positions].map(([cell, pos]) => ({ cell, ...pos }))
      Object.assign(
        entries.find((e) => e.cell === cell),
        { w: 1, h: 1 },
      )
      for (let y = p.y; y < p.y + p.h; y++)
        for (let x = p.x; x < p.x + p.w; x++)
          if (y !== p.y || x !== p.x) entries.push({ cell: null, template: cell, x, y, w: 1, h: 1 })
      writeCells(model.table, entries)
      caretInside(this.root, cell)
    }, 'splitCell')
  },
}
