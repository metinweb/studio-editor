// Excel/Sheets quoted TSV, including tabs/newlines inside quoted cells.
export function parseTsv(text, { maxCells = 10000, maxRows = 1000, maxColumns = 100 } = {}) {
  if (!text.includes('\t')) return null
  const rows = []
  let row = [],
    cell = '',
    quoted = false,
    atStart = true,
    separators = 0,
    cells = 0
  const push = () => {
    row.push(cell)
    cell = ''
    atStart = true
    if (++cells > maxCells || row.length > maxColumns)
      throw new Error('Tablo çok büyük; en fazla 10.000 hücre yapıştırılabilir.')
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && atStart) {
      quoted = true
      atStart = false
    } else if (char === '\t') {
      separators++
      push()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      push()
      rows.push(row)
      row = []
      if (rows.length > maxRows)
        throw new Error('Tablo çok büyük; en fazla 1.000 satır yapıştırılabilir.')
    } else {
      cell += char
      atStart = false
    }
  }
  if (quoted) return null
  if (cell || row.length || !/[\r\n]$/.test(text)) {
    push()
    rows.push(row)
  }
  if (rows.length > maxRows)
    throw new Error('Tablo çok büyük; en fazla 1.000 satır yapıştırılabilir.')
  return separators &&
    rows.length &&
    rows[0].length > 1 &&
    rows.every((item) => item.length === rows[0].length)
    ? rows
    : null
}

export function clipboardSource(html = '', text = '') {
  if (/urn:schemas-microsoft-com:office:excel|Microsoft Excel|<x:ExcelWorkbook/i.test(html))
    return 'excel'
  if (
    /mso-list\s*:|Microsoft Word|class=["']?Mso|urn:schemas-microsoft-com:office:word/i.test(html)
  )
    return 'word'
  if (/docs-internal-guid-|id=["']docs-/i.test(html)) return 'google-docs'
  return html ? 'html' : text.includes('\t') ? 'tsv' : 'text'
}

export function clipboardFragment(html) {
  const start = /<!--\s*StartFragment\s*-->/.exec(html)
  const end = /<!--\s*EndFragment\s*-->/.exec(html)
  return start && end && end.index >= start.index
    ? html.slice(start.index + start[0].length, end.index)
    : html
}
