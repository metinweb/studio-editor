import { writeCells } from './table-operations.js'
import { applySourceCellStyle } from './table-paste-style.js'

// Plan the replacement against logical coordinates before changing the document.
// Never split a destination cell that extends outside the requested rectangle.
export function planTablePaste(target, source, top, left) {
  const bottom = top + source.height,
    right = left + source.width
  if (top < 0 || left < 0 || bottom > target.height || right > target.width)
    return { error: 'overflow' }
  const entries = []
  for (const [cell, p] of target.positions) {
    const intersects = p.x < right && p.x + p.w > left && p.y < bottom && p.y + p.h > top
    if (!intersects) entries.push({ cell, ...p, unchanged: true })
    else if (p.x < left || p.y < top || p.x + p.w > right || p.y + p.h > bottom)
      return { error: 'boundary' }
  }
  for (const [sourceCell, p] of source.positions) {
    const x = left + p.x,
      y = top + p.y
    const template = target.grid[y][x],
      origin = target.positions.get(template)
    if (target.rows[y].parentElement !== target.rows[y + p.h - 1].parentElement)
      return { error: 'section' }
    entries.push({
      cell: origin.x === x && origin.y === y ? template : null,
      template,
      sourceCell,
      x,
      y,
      w: p.w,
      h: p.h,
    })
  }
  return { entries }
}

export function applyTablePaste(table, plan, style = 'target') {
  writeCells(table, plan.entries)
  let first = null
  for (const entry of plan.entries) {
    if (!entry.sourceCell) continue
    // The source is already sanitized by the clipboard pipeline.
    entry.cell.innerHTML = entry.sourceCell.innerHTML || '<br>'
    if (style === 'source') applySourceCellStyle(entry.cell, entry.sourceCell)
    first ||= entry.cell
  }
  return first
}
