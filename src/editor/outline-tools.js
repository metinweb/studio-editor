import { caretInside } from './selection.js'
import { inheritBlockId } from './identity.js'
const heading = /^H[1-6]$/

export function sectionInfo(root, node) {
  if (node?.parentElement !== root || !heading.test(node.tagName)) return null
  const level = Number(node.tagName[1]),
    nodes = [node]
  let next = node.nextSibling
  while (next && !(heading.test(next.nodeName) && Number(next.nodeName[1]) <= level)) {
    nodes.push(next)
    next = next.nextSibling
  }
  let previous = node.previousSibling
  while (previous && !(heading.test(previous.nodeName) && Number(previous.nodeName[1]) <= level))
    previous = previous.previousSibling
  const headings = nodes.filter((n) => heading.test(n.nodeName))
  return {
    nodes,
    headings,
    level,
    previous: previous?.nodeName === node.nodeName ? previous : null,
    next: next?.nodeName === node.nodeName ? next : null,
    promote: headings.every((n) => Number(n.nodeName[1]) > 1),
    demote: headings.every((n) => Number(n.nodeName[1]) < 6),
  }
}

export const outlineTools = {
  moveSection(node, direction) {
    if (!this.editable || this.destroyed || ![-1, 1].includes(direction)) return false
    const info = sectionInfo(this.root, node)
    if (!info || !(direction < 0 ? info.previous : info.next)) return false
    this.transaction(() => {
      const before =
        direction < 0 ? info.previous : sectionInfo(this.root, info.next).nodes.at(-1).nextSibling
      for (const child of info.nodes) this.root.insertBefore(child, before)
      caretInside(this.root, node)
    })
    return true
  },
  changeSectionLevel(node, delta) {
    if (!this.editable || this.destroyed || ![-1, 1].includes(delta)) return false
    const info = sectionInfo(this.root, node)
    if (!info || !(delta < 0 ? info.promote : info.demote)) return false
    let first
    this.transaction(() => {
      for (const old of info.headings) {
        const replacement = this.doc.createElement(`h${Number(old.tagName[1]) + delta}`)
        for (const attr of old.attributes) replacement.setAttribute(attr.name, attr.value)
        inheritBlockId(old, replacement)
        replacement.append(...old.childNodes)
        old.replaceWith(replacement)
        first ||= replacement
      }
      caretInside(this.root, first)
    })
    return true
  },
}
