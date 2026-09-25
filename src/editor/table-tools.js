import { tableGrid, cellRectangle } from './table-grid.js'
import { caretInside, selectRange } from './selection'
import { cleanHtml, escapeHtml } from '../lib/content'
import { planTablePaste, applyTablePaste } from './table-paste.js'
import { applySourceCellStyle } from './table-paste-style.js'

const cellAt = (node) =>
  node?.nodeType === 1 ? node.closest('td,th') : node?.parentElement?.closest('td,th')
const quoteTsv = (text) => (/[\t\r\n"]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text)

export const tableTools = {
  selectedCells(model) {
    const selection = this.cellSelection
    if (!selection || !this.root.contains(selection.anchor) || !this.root.contains(selection.focus))
      return null
    return cellRectangle(
      model?.table === selection.anchor.closest('table')
        ? model
        : tableGrid(selection.anchor.closest('table')),
      selection.anchor,
      selection.focus,
    )
  },
  selectCells(anchor, focus) {
    if (!this.editable || anchor?.closest('table') !== focus?.closest('table')) return false
    const selection = cellRectangle(tableGrid(anchor?.closest('table')), anchor, focus)
    if (!selection) return false
    this.cellSelection = { anchor, focus }
    caretInside(this.root, anchor)
    this.rememberSelection()
    this.publishState()
    return true
  },
  cellPointerDown(event) {
    if (!this.editable || event.button !== 0) return
    const cell = cellAt(event.target)
    const previous = this.cellSelection?.anchor || cellAt(this.context())
    this.cellSelection = null
    this.cellDrag = null
    if (event.shiftKey && cell && previous?.closest('table') === cell.closest('table')) {
      event.preventDefault()
      this.selectCells(previous, cell)
    } else if (cell) this.cellDrag = { anchor: cell, x: event.clientX, y: event.clientY }
    this.publishState()
  },
  cellPointerMove(event) {
    if (!this.cellDrag || !this.editable || !(event.buttons & 1)) return
    const cell = cellAt(event.target)
    if (!cell || (cell === this.cellDrag.anchor && !this.cellSelection)) return
    if (Math.hypot(event.clientX - this.cellDrag.x, event.clientY - this.cellDrag.y) < 5) return
    if (this.selectCells(this.cellDrag.anchor, cell)) event.preventDefault()
  },
  cellKey(event) {
    const cell = this.cellSelection?.focus || cellAt(this.context())
    if (event.shiftKey && event.altKey && /^Arrow/.test(event.key) && cell) {
      const model = tableGrid(cell.closest('table')),
        p = model?.positions.get(cell)
      if (!p) return false
      const y = p.y + (event.key === 'ArrowDown' ? p.h : event.key === 'ArrowUp' ? -1 : 0)
      const x = p.x + (event.key === 'ArrowRight' ? p.w : event.key === 'ArrowLeft' ? -1 : 0)
      const target = model.grid[y]?.[x]
      if (target) this.selectCells(this.cellSelection?.anchor || cell, target)
      event.preventDefault()
      return true
    }
    if (!this.cellSelection) return false
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      this.cellSelection = null
      this.publishState()
      return false
    }
    if (event.key === 'Escape') {
      this.cellSelection = null
      this.publishState()
      event.preventDefault()
      return true
    }
    if (['Backspace', 'Delete'].includes(event.key)) {
      event.preventDefault()
      this.clearCells()
      return true
    }
    if (event.key === 'Tab' || /^Arrow/.test(event.key) || event.key === 'Enter') {
      this.cellSelection = null
      this.publishState()
    }
    return false
  },
  clearCells() {
    const selected = this.selectedCells()
    if (!selected) return
    this.transaction(() => {
      selected.cells.forEach((cell) => {
        cell.innerHTML = '<br>'
      })
      caretInside(this.root, selected.anchor)
    }, 'clearCells')
  },
  cellClipboard(event, cut = false) {
    const selected = this.selectedCells()
    if (!selected || !event.clipboardData || (cut && !this.editable)) return
    const { model, top, bottom, left, right } = selected
    const table = this.doc.createElement('table'),
      tbody = table.createTBody()
    const text = []
    for (let y = top; y < bottom; y++) {
      const row = tbody.insertRow(),
        values = []
      for (let x = left; x < right; x++) {
        const cell = model.grid[y][x],
          p = model.positions.get(cell)
        const origin = p.x === x && p.y === y
        values.push(origin ? quoteTsv(cell.innerText ?? cell.textContent) : '')
        if (origin) {
          const clone = cell.cloneNode(true)
          if (clone.rowSpan === 0) clone.rowSpan = p.h
          row.append(clone)
        }
      }
      text.push(values.join('\t'))
    }
    event.clipboardData.setData('text/html', cleanHtml(table.outerHTML))
    event.clipboardData.setData('text/plain', text.join('\n'))
    event.preventDefault()
    if (cut) this.clearCells()
  },
  pasteCells(result) {
    if (!result.html) return false
    const selected = this.selectedCells(),
      start = selected?.anchor || cellAt(this.context())
    if (!start) return false
    const container = this.doc.createElement('template')
    container.innerHTML = result.plain ? escapeHtml(result.html) : result.html
    const sourceTable = container.content.querySelector('table')
    if (!sourceTable && !selected) return false
    const fail = (message) => {
      this.callbacks.onPaste({
        source: result.source,
        mode: result.mode,
        rows: result.rows,
        columns: result.columns,
        warnings: [message],
        inserted: false,
      })
      return true
    }
    const target = tableGrid(start.closest('table'))
    if (!target) return fail('Bu tablonun hücre yapısı geçersiz veya desteklenen sınırları aşıyor.')
    let assignments = [],
      plan = null
    if (!sourceTable) assignments = selected.cells.map((cell) => [cell, container.innerHTML])
    else {
      const source = tableGrid(sourceTable)
      if (!source) return fail('Panodaki tablo yapısı geçersiz veya desteklenen sınırları aşıyor.')
      const other = container.content.cloneNode(true)
      other.querySelector('table').remove()
      if (other.textContent.trim() || other.querySelector('img,video,audio,table'))
        return fail('Hücrelere yapıştırmak için yalnızca tablo verisini kopyalayın.')
      const p = target.positions.get(start)
      const top = selected?.top ?? p.y,
        left = selected?.left ?? p.x
      if (source.width === 1 && source.height === 1)
        assignments = (selected?.cells || [start]).map((cell) => [
          cell,
          source.grid[0][0].innerHTML,
          source.grid[0][0],
        ])
      else {
        if (
          selected &&
          (selected.right - left !== source.width || selected.bottom - top !== source.height)
        )
          return fail('Seçili alan ile panodaki tablo boyutları eşleşmiyor.')
        plan = planTablePaste(target, source, top, left)
        if (plan.error === 'overflow')
          return fail('Pano verisi tabloya sığmıyor; önce satır veya sütun ekleyin.')
        if (plan.error === 'boundary')
          return fail(
            'Pano alanı birleşik bir hücrenin yalnızca bir bölümünü kapsıyor; hücrenin tamamını seçin.',
          )
        if (plan.error === 'section')
          return fail(
            'Panodaki birleşim tablo başlığı veya gövdesi sınırını aşıyor; aynı bölümde bir alan seçin.',
          )
      }
    }
    this.transaction(() => {
      assignments.forEach(([cell, html, sourceCell]) => {
        cell.innerHTML = cleanHtml(html) || '<br>'
        if (sourceCell && result.tableStyle === 'source') applySourceCellStyle(cell, sourceCell)
      })
      const focus = plan
        ? applyTablePaste(target.table, plan, result.tableStyle)
        : assignments[0][0]
      caretInside(this.root, focus)
    }, 'pasteCells')
    this.callbacks.onPaste({
      source: result.source,
      mode: result.mode,
      rows: result.rows,
      columns: result.columns,
      warnings: result.warnings,
      inserted: true,
    })
    return true
  },
  columnGeometry(table) {
    const model = tableGrid(table)
    if (!model) return null
    const rtl = this.doc.defaultView.getComputedStyle(table).direction === 'rtl'
    const rect = table.getBoundingClientRect(),
      edges = new Map([
        [0, rtl ? rect.right : rect.left],
        [model.width, rtl ? rect.left : rect.right],
      ])
    for (const [cell, p] of model.positions) {
      const r = cell.getBoundingClientRect()
      if (p.x > 0) edges.set(p.x, rtl ? r.right : r.left)
      if (p.x + p.w < model.width) edges.set(p.x + p.w, rtl ? r.left : r.right)
      // Rectangular tables usually expose every boundary in the first row.
      if (edges.size === model.width + 1) break
    }
    const known = [...edges.keys()].sort((a, b) => a - b)
    const boundaries = Array(model.width + 1)
    for (let i = 0; i < known.length - 1; i++) {
      const a = known[i],
        b = known[i + 1]
      for (let x = a; x <= b; x++)
        boundaries[x] = edges.get(a) + ((edges.get(b) - edges.get(a)) * (x - a)) / (b - a)
    }
    return { model, rect, boundaries, visible: known.slice(1, -1), rtl }
  },
  beginColumnResize(table, index) {
    if (!this.editable || !this.root.contains(table)) return null
    const geometry = this.columnGeometry(table)
    if (!geometry?.visible.includes(index)) return null
    this.rememberSelection()
    const session = {
      table,
      index,
      rtl: geometry.rtl,
      before: this.snapshot(),
      range: this.range()?.cloneRange(),
      revision: this.revision,
      style: table.getAttribute('style'),
      groups: [...table.children]
        .filter((node) => node.tagName === 'COLGROUP')
        .map((node) => node.cloneNode(true)),
      cells: [...geometry.model.positions.keys()].map((cell) => ({
        cell,
        style: cell.getAttribute('style'),
        width: cell.getAttribute('width'),
      })),
      widths: geometry.boundaries
        .slice(1)
        .map((value, i) => Math.abs(value - geometry.boundaries[i])),
    }
    for (const group of [...table.children].filter((node) => node.tagName === 'COLGROUP'))
      group.remove()
    const group = this.doc.createElement('colgroup')
    session.widths.forEach((width) => {
      const col = this.doc.createElement('col')
      col.style.width = `${width}px`
      group.append(col)
    })
    table.insertBefore(group, table.caption?.nextSibling || table.firstChild)
    table.style.tableLayout = 'fixed'
    table.style.width = `${geometry.rect.width}px`
    session.cells.forEach(({ cell }) => {
      cell.style.removeProperty('width')
      cell.removeAttribute('width')
    })
    session.group = group
    session.delta = 0
    return session
  },
  previewColumnResize(session, delta) {
    if (!this.editable || !session?.table.isConnected || session.revision !== this.revision) return
    const { widths, index, group } = session
    if (session.rtl) delta = -delta
    const min = Math.min(32, widths[index - 1], widths[index])
    const change = Math.max(min - widths[index - 1], Math.min(widths[index] - min, delta))
    session.delta = change
    group.children[index - 1].style.width = `${widths[index - 1] + change}px`
    group.children[index].style.width = `${widths[index] - change}px`
  },
  finishColumnResize(session, cancel = false) {
    if (!session?.table.isConnected || this.destroyed || session.revision !== this.revision) return
    const { table } = session
    if (cancel || !this.editable || !session.delta) {
      session.group.remove()
      for (const group of [...session.groups].reverse())
        table.insertBefore(group, table.caption?.nextSibling || table.firstChild)
      if (session.style === null) table.removeAttribute('style')
      else table.setAttribute('style', session.style)
      session.cells.forEach(({ cell, style, width }) => {
        if (style === null) cell.removeAttribute('style')
        else cell.setAttribute('style', style)
        if (width === null) cell.removeAttribute('width')
        else cell.setAttribute('width', width)
      })
      if (session.range) selectRange(this.root, session.range)
      this.publishState()
      return
    }
    this.history.checkpoint(session.before)
    // Inserting colgroup shifts DOM bookmark paths; live text ranges remain valid.
    if (session.range) selectRange(this.root, session.range)
    this.commit(session.before)
  },
  updateColumnDefinitions(table, index, command) {
    const groups = [...table.children].filter((node) => node.tagName === 'COLGROUP')
    if (!groups.length) return
    const cols = [...groups[0].children]
    if (groups.length !== 1 || cols.some((col) => col.span !== 1)) {
      groups.forEach((group) => group.remove())
      return
    }
    if (command === 'deleteColumn') cols[index]?.remove()
    else {
      const col = cols[index]?.cloneNode(true)
      if (!col) return
      if (command === 'addColumnBefore') cols[index].before(col)
      else cols[index].after(col)
    }
    const next = [...groups[0].children]
    const weights = next.map((col) => parseFloat(col.style.width) || 1)
    const sum = weights.reduce((a, b) => a + b, 0)
    const width = table.style.width.endsWith('px')
      ? parseFloat(table.style.width)
      : table.getBoundingClientRect().width
    next.forEach((col, i) => {
      col.style.width = `${(width * weights[i]) / sum}px`
    })
  },
}
