import { blockId, findBlock } from './identity.js'
import { currentRange } from './selection'

// Portable selections address text by top-level block id and text offset, so they survive
// serialization and apply to any editor showing the same shared model.

function topLevel(root, node) {
  let block = node
  while (block && block.parentNode !== root) block = block.parentNode
  return block
}
function point(root, node, offset) {
  if (node === root) {
    const child = root.childNodes[Math.min(offset, root.childNodes.length - 1)]
    if (!child) return null
    return {
      block: blockId(child),
      offset: offset >= root.childNodes.length ? child.textContent.length : 0,
    }
  }
  const block = topLevel(root, node)
  if (!block) return null
  const prefix = root.ownerDocument.createRange()
  prefix.selectNodeContents(block)
  prefix.setEnd(node, offset)
  return { block: blockId(block), offset: prefix.toString().length }
}

export function portableSelection(root) {
  const range = currentRange(root)
  if (!range) return null
  const start = point(root, range.startContainer, range.startOffset)
  const end = point(root, range.endContainer, range.endOffset)
  return start && end ? { start, end } : null
}

const validPoint = (value) =>
  value &&
  typeof value.block === 'string' &&
  value.block.length <= 100 &&
  Number.isInteger(value.offset) &&
  value.offset >= 0 &&
  value.offset <= 10000000
export const validPortableSelection = (value) => validPoint(value?.start) && validPoint(value?.end)

function locate(root, { block: id, offset }) {
  const block = findBlock(root, id)
  if (!block) return null
  const walker = root.ownerDocument.createTreeWalker(block, 4)
  let remaining = offset
  let last = null
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (remaining <= text.length) return [text, remaining]
    remaining -= text.length
    last = text
  }
  return last ? [last, last.length] : [block, 0]
}

/** DOM range for a portable selection, or null when its blocks are not in this document. */
export function rangeFromPortable(root, selection) {
  if (!validPortableSelection(selection)) return null
  const start = locate(root, selection.start)
  const end = locate(root, selection.end)
  if (!start || !end) return null
  const range = root.ownerDocument.createRange()
  try {
    range.setStart(...start)
    range.setEnd(...end)
  } catch {
    return null
  }
  if (range.collapsed && (start[0] !== end[0] || start[1] !== end[1])) range.setStart(...end)
  return range
}

/** Stable, readable color for a user id. */
export function presenceColor(id) {
  let hash = 0
  for (const char of String(id)) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return `hsl(${hash % 360} 70% 42%)`
}
