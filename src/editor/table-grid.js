// Logical coordinates are independent of DOM cellIndex and include spans.
export function tableGrid(table) {
  if (!table || table.querySelector?.('table')) return null
  const rows = Array.from(table.rows)
  if (!rows.length || rows.length > 1000) return null
  const grid = rows.map(() => [])
  const positions = new Map()
  const groupEnds = new Map()
  rows.forEach((row, index) => groupEnds.set(row.parentElement, index + 1))
  let width = 0
  for (let y = 0; y < rows.length; y++) {
    let x = 0
    for (const cell of rows[y].cells) {
      while (grid[y][x]) x++
      const groupEnd = groupEnds.get(rows[y].parentElement)
      const h = cell.rowSpan === 0 ? groupEnd - y : cell.rowSpan || 1
      const w = cell.colSpan || 1
      if (x + w > 100 || y + h > groupEnd || (x + w) * rows.length > 10000) return null
      for (let r = y; r < y + h; r++)
        for (let c = x; c < x + w; c++) {
          if (grid[r][c]) return null
          grid[r][c] = cell
        }
      positions.set(cell, { x, y, w, h })
      x += w
      width = Math.max(width, x)
    }
  }
  if (
    !width ||
    grid.some((row) => Array.from({ length: width }, (_, x) => row[x]).some((cell) => !cell))
  )
    return null
  return { table, rows, grid, positions, width, height: rows.length }
}

export function cellRectangle(model, anchor, focus) {
  const a = model?.positions.get(anchor),
    b = model?.positions.get(focus)
  if (!a || !b) return null
  let left = Math.min(a.x, b.x),
    right = Math.max(a.x + a.w, b.x + b.w)
  let top = Math.min(a.y, b.y),
    bottom = Math.max(a.y + a.h, b.y + b.h)
  // Expand to the full footprint of every intersecting merged cell.
  let changed = true
  while (changed) {
    changed = false
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        const p = model.positions.get(model.grid[y][x])
        const bounds = [
          Math.min(left, p.x),
          Math.max(right, p.x + p.w),
          Math.min(top, p.y),
          Math.max(bottom, p.y + p.h),
        ]
        if (
          bounds[0] !== left ||
          bounds[1] !== right ||
          bounds[2] !== top ||
          bounds[3] !== bottom
        ) {
          ;[left, right, top, bottom] = bounds
          changed = true
        }
      }
  }
  const cells = [...new Set(model.grid.slice(top, bottom).flatMap((row) => row.slice(left, right)))]
  return { model, anchor, focus, left, right, top, bottom, cells }
}
