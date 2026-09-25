// Match computed RGB colors to the palette's hex values without changing
// document styles. Other CSS color spaces can be displayed as-is by the UI.
function paletteColor(value) {
  if (!value || value === 'transparent') return 'transparent'
  const rgb = value.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/)
  if (!rgb) return value.toLowerCase()
  if (rgb[4] !== undefined && Number(rgb[4]) === 0) return 'transparent'
  if (rgb[4] !== undefined && Number(rgb[4]) !== 1) return value
  return (
    '#' +
    rgb
      .slice(1, 4)
      .map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0'))
      .join('')
  )
}

export function selectionColors(root, element, style, pending) {
  const view = root.ownerDocument.defaultView
  // Background color is not inherited in CSS: a nested <strong> may be
  // transparent even though its surrounding span highlights the text.
  let backgroundColor = 'transparent'
  for (let node = element; node && root.contains(node); node = node.parentElement) {
    const color = paletteColor(
      node === element ? style.backgroundColor : view.getComputedStyle(node).backgroundColor,
    )
    if (color !== 'transparent') {
      backgroundColor = color
      break
    }
  }
  let color = paletteColor(style.color)
  if (pending?.color) {
    color =
      pending.color === 'inherit'
        ? paletteColor(
            view.getComputedStyle(element.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,div') || root)
              .color,
          )
        : paletteColor(pending.color)
  }
  if (pending?.backgroundColor) backgroundColor = paletteColor(pending.backgroundColor)
  return { color, backgroundColor }
}
