const cellStyles = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-align',
  'vertical-align',
  // Firefox enumerates vertical-align as these baseline longhands.
  'alignment-baseline',
  'baseline-shift',
  'baseline-source',
  'line-height',
  'padding',
  'border',
  'border-width',
  'border-style',
  'border-color',
])
export const allowedCellStyle = (key) =>
  cellStyles.has(key) ||
  /^padding-(top|right|bottom|left)$/.test(key) ||
  /^border-(top|right|bottom|left)(-(width|style|color))?$/.test(key)

export function applySourceCellStyle(target, source) {
  // Copy cell presentation, never sizing, positioning, resource URLs or priority.
  const draft = source.ownerDocument.createElement('td')
  for (const [attribute, property] of [
    ['bgcolor', 'background-color'],
    ['align', 'text-align'],
    ['valign', 'vertical-align'],
  ]) {
    if (source.hasAttribute(attribute))
      draft.style.setProperty(property, source.getAttribute(attribute))
  }
  for (const key of Array.from(source.style))
    if (allowedCellStyle(key)) draft.style.setProperty(key, source.style.getPropertyValue(key))
  for (const key of Array.from(target.style))
    if (allowedCellStyle(key)) target.style.removeProperty(key)
  for (const attr of ['bgcolor', 'align', 'valign']) target.removeAttribute(attr)
  for (const key of Array.from(draft.style)) {
    const value = draft.style.getPropertyValue(key)
    if (!/url\s*\(|expression\s*\(|var\s*\(|env\s*\(|attr\s*\(|javascript:/i.test(value))
      target.style.setProperty(key, value)
  }
  if (!target.style.length) target.removeAttribute('style')
}
