import { blockId, findBlock } from './identity.js'
// Selections belong to the editor document, never to the surrounding application.
export function currentRange(root) {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  return root.contains(range.startContainer) && root.contains(range.endContainer) ? range : null
}

export function selectRange(root, range) {
  const selection = root.ownerDocument.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

function pathOf(root, node) {
  const path = []
  while (node && node !== root) {
    path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node))
    node = node.parentNode
  }
  return path
}

export function bookmark(root) {
  const range = currentRange(root)
  if (!range) return null
  function anchor(node, offset) {
    if (node === root) return null
    let block = node
    while (block.parentNode !== root) block = block.parentNode
    const prefix = root.ownerDocument.createRange()
    prefix.selectNodeContents(block)
    prefix.setEnd(node, offset)
    return {
      id: blockId(block),
      path: pathOf(block, node),
      textOffset: prefix.toString().length,
      offset,
      affinity: 1,
    }
  }
  return {
    start: pathOf(root, range.startContainer),
    startOffset: range.startOffset,
    end: pathOf(root, range.endContainer),
    endOffset: range.endOffset,
    startAnchor: anchor(range.startContainer, range.startOffset),
    endAnchor: anchor(range.endContainer, range.endOffset),
  }
}

export function restore(root, position) {
  const range = root.ownerDocument.createRange()
  function point(path, offset, anchor) {
    const block = anchor && findBlock(root, anchor.id)
    if (block && anchor.mapped) {
      let remaining = anchor.textOffset
      const walker = root.ownerDocument.createTreeWalker(block, 4)
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (remaining <= text.length) return [text, Math.max(0, remaining)]
        remaining -= text.length
      }
      return [block, block.childNodes.length]
    }
    let node = block || root
    if (block) path = anchor.path
    for (const index of path) {
      if (!node.childNodes[index]) return [root, root.childNodes.length]
      node = node.childNodes[index]
    }
    return [node, Math.min(offset, node.nodeType === 3 ? node.length : node.childNodes.length)]
  }
  if (position) {
    range.setStart(...point(position.start, position.startOffset, position.startAnchor))
    range.setEnd(...point(position.end, position.endOffset, position.endAnchor))
  } else {
    range.selectNodeContents(root)
    range.collapse(false)
  }
  selectRange(root, range)
  return range
}

export const elementAt = (node) => (node?.nodeType === 1 ? node : node?.parentElement)
export const blockSelector = 'p,h1,h2,h3,h4,h5,h6,li,td,th,pre,div'
export function closestBlock(root, node) {
  const block = elementAt(node)?.closest(blockSelector)
  return block && root.contains(block) && block !== root ? block : null
}

export function textNodes(root, range, limit = Infinity) {
  const common = range.commonAncestorContainer
  if (common.nodeType === 3)
    return common.length &&
      range.endOffset > range.startOffset &&
      !common.parentElement.closest(
        'figure[data-studio-embed],[data-studio-mention],[data-studio-task-control]',
      )
      ? [common]
      : []
  const walker = root.ownerDocument.createTreeWalker(common, 4)
  const result = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      !node.length ||
      !range.intersectsNode(node) ||
      node.parentElement.closest(
        'figure[data-studio-embed],[data-studio-mention],[data-studio-task-control]',
      )
    )
      continue
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.length
    if (end > start) {
      result.push(node)
      if (result.length >= limit) break
    }
  }
  return result
}

export function selectedBlocks(root, range) {
  if (range.collapsed) return [closestBlock(root, range.startContainer)].filter(Boolean)
  return [
    ...new Set(
      textNodes(root, range)
        .map((node) => closestBlock(root, node))
        .filter(Boolean),
    ),
  ]
}

export function unwrap(element) {
  element.replaceWith(...element.childNodes)
}

const inlineTags = new Set([
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'STRIKE',
  'SUB',
  'SUP',
  'CODE',
  'SPAN',
  'A',
])

// Split inline ancestors at both selection edges. A partial unbold operation must
// preserve formatting on the unselected text on either side of the selection.
function splitInlineBoundary(marker) {
  while (inlineTags.has(marker.parentElement?.tagName)) {
    const parent = marker.parentElement
    const right = parent.cloneNode(false)
    while (marker.nextSibling) right.append(marker.nextSibling)
    parent.after(marker)
    if (right.childNodes.length) marker.after(right)
    if (!parent.childNodes.length) parent.remove()
  }
}

export function markRange(root, range, split = false) {
  const collapsed = range.collapsed
  const doc = root.ownerDocument
  const start = doc.createElement('span')
  const end = doc.createElement('span')
  start.dataset.studioMarker = 'start'
  end.dataset.studioMarker = 'end'
  const endRange = range.cloneRange()
  endRange.collapse(false)
  endRange.insertNode(end)
  const startRange = range.cloneRange()
  startRange.collapse(true)
  startRange.insertNode(start)
  if (split) {
    splitInlineBoundary(end)
    splitInlineBoundary(start)
  }
  const between = doc.createRange()
  between.setStartAfter(start)
  between.setEndBefore(end)
  return {
    range: between,
    restore() {
      const result = doc.createRange()
      result.setStartAfter(start)
      result.setEndBefore(end)
      start.remove()
      end.remove()
      if (collapsed) result.collapse(true)
      selectRange(root, result)
    },
  }
}

export function caretAfter(root, node) {
  const range = root.ownerDocument.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selectRange(root, range)
}

export function caretInside(root, node, atEnd = false) {
  const range = root.ownerDocument.createRange()
  range.selectNodeContents(node)
  range.collapse(!atEnd)
  selectRange(root, range)
}
