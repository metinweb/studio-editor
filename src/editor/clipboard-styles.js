import { allowedCellStyle } from './table-paste-style.js'
const inherited = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align',
  'direction',
])
const allowed = (name) =>
  allowedCellStyle(name) ||
  inherited.has(name) ||
  ['width', 'height', 'list-style-type'].includes(name)
const safe = (value) => !/(?:url|expression|var|env|attr)\s*\(|javascript:|@import/i.test(value)
// Only simple selectors are supported. No imports, nesting, pseudo classes or external sheets.
export function inlineClipboardStyles(root, raw, doc) {
  const metadata = new WeakMap()
  for (const node of root.querySelectorAll('[style]'))
    metadata.set(node, node.getAttribute('style'))
  const template = doc.createElement('template')
  template.innerHTML = raw
  const css = [...template.content.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  if (css.length > 200000) return metadata
  const Sheet = doc.defaultView?.CSSStyleSheet || globalThis.CSSStyleSheet
  if (!Sheet) return metadata
  const sheet = new Sheet()
  try {
    sheet.replaceSync(css)
  } catch {
    return metadata
  }
  const rules = []
  for (const rule of [...sheet.cssRules].slice(0, 500)) {
    if (!rule.selectorText || !rule.style) continue
    for (const selector of rule.selectorText.split(',').slice(0, 16)) {
      const value = selector.trim()
      if (
        !/^(?:[a-z][\w-]*)?(?:[.#][\w-]+)*(?:\s+(?:[a-z][\w-]*)?(?:[.#][\w-]+)*)*$/i.test(value) ||
        !value ||
        value.length > 200
      )
        continue
      const weight =
        (value.match(/#/g)?.length || 0) * 100 +
        (value.match(/\./g)?.length || 0) * 10 +
        (value.match(/(?:^|\s)[a-z]/gi)?.length || 0)
      rules.push({ selector: value, style: rule.style, weight })
    }
  }
  const nodes = [...root.querySelectorAll('*')]
  if (nodes.length * rules.length > 500000) return metadata
  for (const node of nodes) {
    const declarations = new Map()
    function add(style, weight) {
      for (const key of style) {
        const value = style.getPropertyValue(key),
          important = style.getPropertyPriority(key) === 'important'
        if (!allowed(key) || !safe(value)) continue
        const rank = weight + (important ? 100000 : 0),
          previous = declarations.get(key)
        if (!previous || rank >= previous.rank) declarations.set(key, { value, rank, important })
      }
    }
    for (const rule of rules) if (node.matches(rule.selector)) add(rule.style, rule.weight)
    add(node.style, 10000)
    for (const [key, value] of declarations)
      node.style.setProperty(key, value.value, value.important ? 'important' : '')
    for (const key of inherited)
      if (!node.style.getPropertyValue(key)) {
        const value = node.parentElement?.style.getPropertyValue(key)
        if (value && safe(value)) node.style.setProperty(key, value)
      }
  }
  return metadata
}

export function listMarker(marker, format = '') {
  const decimal = /^(\d+)[.)]/.exec(marker)
  if (decimal) return { value: Number(decimal[1]), type: 'decimal' }
  const letters = /^([a-z]+)[.)]/i.exec(marker)?.[1]
  if (!letters || letters.length > 8) return null
  const lower = letters === letters.toLowerCase()
  if (
    !format.startsWith('alpha') &&
    /^[ivxlcdm]+$/i.test(letters) &&
    (letters.length > 1 || /^[ivx]$/i.test(letters) || format.startsWith('roman'))
  ) {
    const digits = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 },
      text = letters.toLowerCase()
    let value = 0
    for (let i = 0; i < text.length; i++)
      value += digits[text[i]] < (digits[text[i + 1]] || 0) ? -digits[text[i]] : digits[text[i]]
    return value > 0 && value <= 3999
      ? { value, type: lower ? 'lower-roman' : 'upper-roman' }
      : null
  }
  if (letters.length > 2) return null
  return {
    value: [...letters.toLowerCase()].reduce((v, c) => v * 26 + c.charCodeAt(0) - 96, 0),
    type: lower ? 'lower-alpha' : 'upper-alpha',
  }
}
