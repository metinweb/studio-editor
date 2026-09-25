import { tableGrid } from './table-grid.js'

// Plan changes before touching the DOM. Entries retain the original cell nodes.
export function planTableEdit(model, cell, command) {
  const p = model?.positions.get(cell)
  if (!p) return null
  const row = ['addRow', 'addRowBefore', 'deleteRow', 'appendRow'].includes(command)
  if (!row && !['addColumn', 'addColumnBefore', 'deleteColumn'].includes(command)) return null
  const deleting = command.startsWith('delete')
  const k = row
    ? command === 'appendRow'
      ? model.height
      : p.y + (command === 'addRow' ? 1 : 0)
    : p.x + (command === 'addColumn' ? p.w : 0)
  const width = model.width + (row ? 0 : deleting ? -1 : 1)
  const height = model.height + (row ? (deleting ? -1 : 1) : 0)
  if (width > 100 || height > 1000 || width * height > 10000) return null
  if (!width || !height) return { removeTable: true }
  const entries = []
  for (const [node, pos] of model.positions) {
    const entry = { cell: node, ...pos }
    const start = row ? 'y' : 'x',
      span = row ? 'h' : 'w'
    const from = entry[start],
      end = from + entry[span]
    if (deleting) {
      if (from <= k && end > k) {
        if (entry[span] === 1) continue
        entry[span]--
      }
      if (from > k) entry[start]--
    } else {
      const openEndedRow =
        row &&
        command !== 'appendRow' &&
        node.rowSpan === 0 &&
        from < k &&
        end === k &&
        node.parentElement.parentElement === cell.parentElement.parentElement
      if ((from < k && end > k) || openEndedRow) entry[span]++
      if (from >= k) entry[start]++
    }
    entries.push(entry)
  }
  if (!deleting) {
    const occupied = new Set()
    for (const e of entries) {
      if (row && e.y <= k && e.y + e.h > k) for (let x = e.x; x < e.x + e.w; x++) occupied.add(x)
      if (!row && e.x <= k && e.x + e.w > k) for (let y = e.y; y < e.y + e.h; y++) occupied.add(y)
    }
    for (let i = 0; i < (row ? width : height); i++)
      if (!occupied.has(i)) {
        entries.push({
          cell: null,
          template: model.grid[row ? p.y : i][row ? i : p.x],
          x: row ? i : k,
          y: row ? k : i,
          w: 1,
          h: 1,
        })
      }
  }
  return {
    entries,
    row,
    deleting,
    k,
    width,
    height,
    focus: { x: Math.min(row ? p.x : k, width - 1), y: Math.min(row ? k : p.y, height - 1) },
  }
}

export function emptyCell(doc, template) {
  const cell = doc.createElement(template.tagName)
  for (const attribute of ['style', 'scope'])
    if (template.hasAttribute(attribute))
      cell.setAttribute(attribute, template.getAttribute(attribute))
  // A merged cell's explicit size must not be duplicated into every split cell.
  cell.style.removeProperty('width')
  cell.style.removeProperty('height')
  if (!cell.style.length) cell.removeAttribute('style')
  cell.innerHTML = '<br>'
  return cell
}

export function writeCells(table, entries) {
  const rows = [...table.rows],
    doc = table.ownerDocument
  for (const entry of entries) {
    entry.cell ||= emptyCell(doc, entry.template)
    if (entry.unchanged) continue
    for (const [attr, value] of [
      ['colspan', entry.w],
      ['rowspan', entry.h],
    ]) {
      if (value > 1) entry.cell.setAttribute(attr, String(value))
      else entry.cell.removeAttribute(attr)
    }
  }
  const byRow = rows.map(() => [])
  entries.forEach((e) => byRow[e.y].push(e))
  // Detach first: a rowspan origin may move out of a row being deleted.
  entries.forEach((e) => e.cell.remove())
  rows.forEach((row, y) =>
    row.replaceChildren(...byRow[y].sort((a, b) => a.x - b.x).map((e) => e.cell)),
  )
  if (!tableGrid(table)) throw new Error('Tablo işlemi geçersiz bir hücre düzeni oluşturdu.')
}

export function applyTableEdit(model, cell, plan) {
  const { table } = model
  if (plan.row) {
    if (plan.deleting) model.rows[plan.k].remove()
    else {
      const next = table.ownerDocument.createElement('tr')
      if (plan.k === model.height) model.rows.at(-1).after(next)
      else if (plan.k === model.positions.get(cell).y) cell.parentElement.before(next)
      else cell.parentElement.after(next)
    }
  }
  writeCells(table, plan.entries)
  for (const section of [...table.children])
    if (/^(THEAD|TBODY|TFOOT)$/.test(section.tagName) && !section.rows.length) section.remove()
  return tableGrid(table).grid[plan.focus.y][plan.focus.x]
}
