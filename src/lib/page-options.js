/** Normalized page setup shared by printing, DOCX export and the page view. */
export function printOptions(options = {}) {
  return {
    size: options.size === 'Letter' ? 'Letter' : 'A4',
    landscape: !!options.landscape,
    margin: Math.max(10, Math.min(40, Number(options.margin) || 20)),
    header: String(options.header || '').slice(0, 200),
    footer: String(options.footer || '').slice(0, 200),
  }
}
