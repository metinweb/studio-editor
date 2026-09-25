import { closestBlock, textNodes, selectRange, unwrap } from './selection'
const selector = '[data-studio-suggestion]'
function read(node) {
  try {
    const item = JSON.parse(node.getAttribute('data-studio-suggestion'))
    if (
      typeof item.id !== 'string' ||
      item.id.length > 120 ||
      typeof item.before !== 'string' ||
      item.before.length > 4000 ||
      typeof item.after !== 'string' ||
      item.after.length > 4000 ||
      typeof item.author !== 'string' ||
      item.author.length > 120 ||
      !Number.isFinite(item.date)
    )
      return null
    return item
  } catch {
    return null
  }
}
export const suggestionTools = {
  suggestions() {
    return [...this.root.querySelectorAll(selector)]
      .map((node) => {
        const item = read(node)
        return item ? { ...item, stale: node.textContent !== item.before } : null
      })
      .filter(Boolean)
  },
  suggestText(after, author = 'Ben') {
    if (!this.editable || typeof after !== 'string' || after.length > 4000) return false
    this.restoreSelection()
    const range = this.range(),
      before = range.toString()
    if (
      range.collapsed ||
      !before ||
      before.length > 4000 ||
      before === after ||
      closestBlock(this.root, range.startContainer) !==
        closestBlock(this.root, range.endContainer) ||
      textNodes(this.root, range).some((n) =>
        n.parentElement.closest(`${selector},[data-studio-thread]`),
      )
    )
      return false
    this.transaction((range) => {
      const span = this.doc.createElement('span')
      span.setAttribute(
        'data-studio-suggestion',
        JSON.stringify({
          id: crypto.randomUUID(),
          before,
          after,
          author: String(author).slice(0, 120),
          date: Date.now(),
        }),
      )
      span.append(range.extractContents())
      range.insertNode(span)
      range.selectNodeContents(span)
      selectRange(this.root, range)
    }, 'suggestText')
    return true
  },
  resolveSuggestion(id, accept) {
    if (!this.editable) return false
    const node = [...this.root.querySelectorAll(selector)].find((node) => read(node)?.id === id),
      item = node && read(node)
    if (!item || (accept && node.textContent !== item.before)) return false
    this.transaction(
      () => {
        if (accept) node.replaceWith(this.doc.createTextNode(item.after))
        else unwrap(node)
      },
      accept ? 'acceptSuggestion' : 'rejectSuggestion',
    )
    return true
  },
  focusSuggestion(id) {
    const node = [...this.root.querySelectorAll(selector)].find((node) => read(node)?.id === id)
    if (!node) return
    this.root.focus()
    const range = this.doc.createRange()
    range.selectNodeContents(node)
    selectRange(this.root, range)
    node.scrollIntoView({ block: 'center' })
    this.rememberSelection()
  },
}
