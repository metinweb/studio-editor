// Sidecar identities never become data attributes in saved/published HTML.
const ids = new WeakMap()
export function blockId(node) {
  if (!ids.has(node)) ids.set(node, crypto.randomUUID())
  return ids.get(node)
}
export function captureBlocks(root) {
  return [...root.childNodes].map((node) => ({ id: blockId(node), text: node.textContent || '' }))
}
export function restoreBlockIds(root, values = []) {
  const used = new Set()
  ;[...root.childNodes].forEach((node, index) => {
    const value = values[index]
    if (typeof value === 'string' && !used.has(value)) {
      ids.set(node, value)
      used.add(value)
    } else blockId(node)
  })
}
export function findBlock(root, id) {
  return [...root.childNodes].find((node) => ids.get(node) === id)
}
