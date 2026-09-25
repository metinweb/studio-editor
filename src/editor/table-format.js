import { tableGrid } from './table-grid.js'

const properties = ['background-color', 'color', 'text-align', 'vertical-align', 'padding']
const sides = ['top', 'right', 'bottom', 'left']
const color = (value) => /^#[\da-f]{6}$/i.test(value) || value === 'transparent'

// Validate the whole draft before touching any cells; partial application is surprising.
export function validCellFormat(patch) {
  if (!patch || typeof patch !== 'object') return false
  return Object.entries(patch).every(([key, value]) => {
    if (key === 'reset') return value === true
    if (key === 'background-color' || key === 'color') return color(value)
    if (key === 'text-align') return ['left', 'center', 'right', 'justify'].includes(value)
    if (key === 'vertical-align') return ['top', 'middle', 'bottom'].includes(value)
    if (key === 'padding') return Number.isInteger(value) && value >= 0 && value <= 48
    if (key === 'border')
      return (
        value &&
        ['all', 'outer', 'inner', 'none', 'reset'].includes(value.mode) &&
        Number.isInteger(value.width) &&
        value.width >= 0 &&
        value.width <= 8 &&
        ['solid', 'dashed', 'dotted'].includes(value.style) &&
        color(value.color)
      )
    return false
  })
}

export const tableFormat = {
  captureCellFormat() {
    if (!this.editable) return null
    const selection = this.selectedCells()
    const cell = this.context()?.closest('td,th')
    const model = selection?.model || tableGrid(cell?.closest('table'))
    if (!model || (!selection && !model.positions.has(cell))) return null
    const cells = selection?.cells || [cell]
    const values = Object.fromEntries(
      properties.map((property) => {
        const unique = new Set(cells.map((node) => node.style.getPropertyValue(property)))
        return [property, unique.size === 1 ? [...unique][0] : null]
      }),
    )
    const p = model.positions.get(cells[0])
    return {
      revision: this.revision,
      cells,
      table: model.table,
      values,
      anchor: selection?.anchor || cell,
      focus: selection?.focus || cell,
      multiple: !!selection,
      left: selection?.left ?? p.x,
      right: selection?.right ?? p.x + p.w,
      top: selection?.top ?? p.y,
      bottom: selection?.bottom ?? p.y + p.h,
    }
  },
  formatCells(session, patch) {
    if (
      !this.editable ||
      !session ||
      session.revision !== this.revision ||
      !validCellFormat(patch) ||
      !this.root.contains(session.table)
    )
      return false
    const model = tableGrid(session.table)
    if (!model || session.cells.some((cell) => !model.positions.has(cell))) return false
    this.transaction(() => {
      for (const cell of session.cells) {
        if (patch.reset) {
          properties.forEach((property) => cell.style.removeProperty(property))
          cell.style.removeProperty('border')
          sides.forEach((side) => cell.style.removeProperty(`border-${side}`))
        }
        for (const property of properties) {
          if (Object.hasOwn(patch, property))
            cell.style.setProperty(
              property,
              property === 'padding' ? `${patch[property]}px` : patch[property],
            )
        }
        if (patch.border) {
          const { mode, width, style, color } = patch.border
          const p = model.positions.get(cell)
          const outer = [
            p.y === session.top,
            p.x + p.w === session.right,
            p.y + p.h === session.bottom,
            p.x === session.left,
          ]
          cell.style.removeProperty('border')
          sides.forEach((side, index) => {
            if (mode === 'reset') cell.style.removeProperty(`border-${side}`)
            else {
              const enabled =
                mode === 'all' ||
                (mode === 'outer' && outer[index]) ||
                (mode === 'inner' && !outer[index])
              cell.style.setProperty(
                `border-${side}`,
                enabled ? `${width}px ${style} ${color}` : 'none',
              )
            }
          })
        }
        if (!cell.style.length) cell.removeAttribute('style')
      }
    }, 'formatCells')
    if (session.multiple) this.selectCells(session.anchor, session.focus)
    return true
  },
}
