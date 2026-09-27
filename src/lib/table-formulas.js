const fail = (code) => {
  throw new Error(code)
}
export function cellAddress(row, column) {
  let letters = ''
  for (let n = column + 1; n; n = Math.floor((n - 1) / 26))
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  return letters + (row + 1)
}
export function evaluateFormula(source, resolve) {
  if (typeof source !== 'string' || source.length > 500) fail('#FORMULA!')
  const text = source.trim().replace(/^=/, '').toUpperCase()
  const tokens =
    text
      .match(/(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|[A-Z]+[1-9]\d*|[A-Z]+|[()+\-*/, :]/g)
      ?.filter((t) => t !== ' ') || []
  if (tokens.join('') !== text.replace(/\s/g, '') || tokens.length > 250) fail('#FORMULA!')
  let index = 0,
    depth = 0
  const number = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('#VALUE!')
    return value
  }
  const address = (value) => {
    const match = /^([A-Z]+)([1-9]\d*)$/.exec(value)
    if (!match) fail('#FORMULA!')
    const col = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
    const row = Number(match[2]) - 1
    if (row > 999 || col > 99) fail('#REF!')
    return [row, col]
  }
  function atom() {
    if (++depth > 40) fail('#FORMULA!')
    try {
      const token = tokens[index++]
      if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * number(atom())
      if (token === '(') {
        const result = expression()
        if (tokens[index++] !== ')') fail('#FORMULA!')
        return result
      }
      if (/^(?:\d|\.)/.test(token || '')) return number(Number(token))
      if (/^[A-Z]+[1-9]\d*$/.test(token || '')) {
        const [row, col] = address(token)
        if (tokens[index] !== ':') return resolve(row, col)
        index++
        const [lastRow, lastCol] = address(tokens[index++])
        const values = []
        if ((Math.abs(lastRow - row) + 1) * (Math.abs(lastCol - col) + 1) > 5000) fail('#REF!')
        for (let r = Math.min(row, lastRow); r <= Math.max(row, lastRow); r++)
          for (let c = Math.min(col, lastCol); c <= Math.max(col, lastCol); c++)
            values.push(resolve(r, c))
        return values
      }
      if (
        !['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ABS'].includes(token) ||
        tokens[index++] !== '('
      )
        fail('#FORMULA!')
      const args = []
      if (tokens[index] !== ')') {
        args.push(expression())
        while (tokens[index] === ',') {
          index++
          args.push(expression())
        }
      }
      if (tokens[index++] !== ')') fail('#FORMULA!')
      const values = args
        .flat()
        .filter((v) => typeof v === 'number')
        .map(number)
      if (token === 'COUNT') return values.length
      if (token === 'SUM') return values.reduce((a, b) => a + b, 0)
      if (!values.length) fail('#VALUE!')
      if (token === 'AVERAGE') return values.reduce((a, b) => a + b, 0) / values.length
      if (token === 'MIN') return Math.min(...values)
      if (token === 'MAX') return Math.max(...values)
      if (token === 'ABS' && args.length === 1) return Math.abs(number(args[0]))
      if (token === 'ROUND' && args.length === 2) {
        const places = number(args[1])
        if (!Number.isInteger(places) || Math.abs(places) > 8) fail('#VALUE!')
        return Math.round(number(args[0]) * 10 ** places) / 10 ** places
      }
      fail('#FORMULA!')
    } finally {
      depth--
    }
  }
  function product() {
    let value = atom()
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++],
        right = number(atom())
      if (op === '/' && right === 0) fail('#DIV/0!')
      value = op === '*' ? number(value) * right : number(value) / right
    }
    return value
  }
  function expression() {
    let value = product()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++],
        right = number(product())
      value = op === '+' ? number(value) + right : number(value) - right
    }
    return value
  }
  const result = number(expression())
  if (index !== tokens.length) fail('#FORMULA!')
  return result
}
export function tableShape(table) {
  const rows = [...table.rows],
    width = rows[0]?.cells.length || 0
  if (
    !width ||
    rows.length > 1000 ||
    width > 100 ||
    rows.length * width > 5000 ||
    table.querySelector('table,[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])') ||
    rows.some((row) => row.cells.length !== width)
  )
    return null
  return `${rows.length}:${width}`
}
export function calculateTable(table, override = null) {
  const shape = tableShape(table),
    cache = new Map(),
    visiting = new Set()
  let reads = 0
  function read(row, col) {
    if (++reads > 20000 || visiting.size > 50) fail('#LIMIT!')
    const cell = table.rows[row]?.cells[col]
    if (!cell) fail('#REF!')
    if (cache.has(cell)) return cache.get(cell)
    if (visiting.has(cell)) fail('#CYCLE!')
    const widget = cell.querySelector('[data-studio-formula]')
    const formula = override?.cell === cell ? override.expression : widget?.dataset.studioFormula
    if (!widget && override?.cell !== cell) {
      const text = cell.textContent.trim().replace(/\u00a0/g, '')
      return text === ''
        ? null
        : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)
          ? Number(text)
          : null
    }
    if (!shape) fail('#TABLE!')
    if (override?.cell !== cell && widget.dataset.studioFormulaShape !== shape) fail('#REF!')
    visiting.add(cell)
    try {
      const result = evaluateFormula(formula, read)
      cache.set(cell, result)
      return result
    } finally {
      visiting.delete(cell)
    }
  }
  return (cell) => {
    try {
      return { value: read(cell.parentElement.rowIndex, cell.cellIndex), error: '' }
    } catch (e) {
      return { value: null, error: /^#[A-Z/0-9]+!$/.test(e.message) ? e.message : '#FORMULA!' }
    }
  }
}
export function normalizeTableFormulas(root) {
  const tables = new Map()
  for (const widget of root.querySelectorAll('[data-studio-formula]')) {
    const cell = widget.closest('td,th'),
      table = cell?.closest('table')
    if (
      !widget.matches('span') ||
      !table ||
      !root.contains(table) ||
      widget.dataset.studioFormula.length > 500
    ) {
      for (const attr of [...widget.attributes])
        if (attr.name.startsWith('data-studio-formula') || attr.name === 'contenteditable')
          widget.removeAttribute(attr.name)
      continue
    }
    if (!tables.has(table)) tables.set(table, calculateTable(table))
    if (widget.dataset.studioFormulaShape !== tableShape(table))
      widget.dataset.studioFormulaShape = 'invalid'
    const result = tables.get(table)(cell)
    const places = Number(widget.dataset.studioFormulaPrecision ?? 2)
    const precision = Number.isFinite(places) ? Math.max(0, Math.min(8, Math.floor(places))) : 2
    const text =
      result.error ||
      (result.value === null ? '#VALUE!' : Number(result.value.toFixed(precision)).toString())
    if (widget.textContent !== text) widget.textContent = text
    widget.contentEditable = 'false'
    widget.title = widget.dataset.studioFormula
  }
}
