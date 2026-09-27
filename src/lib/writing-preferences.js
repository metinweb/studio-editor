export const defaultWritingPreferences = () => ({
  enabled: false,
  smartSymbols: true,
  rules: [
    { from: 'teh', to: 'the' },
    { from: 'adn', to: 'and' },
    { from: 'recieve', to: 'receive' },
    { from: 'yalnış', to: 'yanlış' },
    { from: 'yanlız', to: 'yalnız' },
  ],
})
export function normalizeWritingPreferences(value) {
  const rules = [],
    seen = new Set()
  for (const item of Array.isArray(value?.rules) ? value.rules.slice(0, 100) : []) {
    const from = String(item?.from || '').trim(),
      to = String(item?.to || '')
    if (!from || from.length > 60 || /\s/u.test(from) || !to || to.length > 1000 || seen.has(from))
      continue
    seen.add(from)
    rules.push({ from, to })
  }
  return { enabled: value?.enabled === true, smartSymbols: value?.smartSymbols === true, rules }
}
export const defaultPen = () => ({
  enabled: false,
  color: '#2563eb',
  backgroundColor: '#ffffff',
  highlight: false,
  fontSize: 16,
  bold: false,
  italic: false,
  underline: false,
})
export function normalizePen(value) {
  const defaults = defaultPen()
  return {
    ...Object.fromEntries(
      ['enabled', 'highlight', 'bold', 'italic', 'underline'].map((k) => [k, value?.[k] === true]),
    ),
    color: /^#[0-9a-f]{6}$/i.test(value?.color) ? value.color : defaults.color,
    backgroundColor: /^#[0-9a-f]{6}$/i.test(value?.backgroundColor)
      ? value.backgroundColor
      : defaults.backgroundColor,
    fontSize: Math.max(8, Math.min(200, Number(value?.fontSize) || 16)),
  }
}
export function penStyles(pen) {
  return {
    color: pen.color,
    backgroundColor: pen.highlight ? pen.backgroundColor : 'transparent',
    fontSize: `${pen.fontSize}px`,
    fontWeight: pen.bold ? '700' : '400',
    fontStyle: pen.italic ? 'italic' : 'normal',
    textDecoration: pen.underline ? 'underline' : 'none',
  }
}
