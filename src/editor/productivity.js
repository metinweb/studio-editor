import { currentRange, closestBlock, caretInside, selectRange } from './selection'
import { findBlock } from './identity.js'
import { contentStyles } from './writing-widgets.js'

export const writingCommands = [
  { id: 'h1', label: 'Başlık 1', en: 'Heading 1', hint: '#' },
  { id: 'h2', label: 'Başlık 2', en: 'Heading 2', hint: '##' },
  { id: 'h3', label: 'Başlık 3', en: 'Heading 3', hint: '###' },
  { id: 'ul', label: 'Madde işaretli liste', en: 'Bullet list', hint: '-' },
  { id: 'ol', label: 'Numaralı liste', en: 'Numbered list', hint: '1.' },
  { id: 'blockquote', label: 'Alıntı', en: 'Quote', hint: '>' },
  { id: 'pre', label: 'Kod bloğu', en: 'Code block', hint: '```' },
  { id: 'hr', label: 'Yatay çizgi', en: 'Horizontal rule', hint: '---' },
  { id: 'task', label: 'Görev listesi', en: 'Task list', hint: '[]' },
  ...contentStyles.filter((s) => s.id).map((s) => ({ ...s, id: `style:${s.id}`, hint: 'Stil' })),
  { id: 'table', label: 'Tablo ekle', en: 'Insert table', hint: '3 × 3', action: true },
  { id: 'media', label: 'Medya kütüphanesi', en: 'Media library', hint: '↗', action: true },
  { id: 'embed', label: 'Bağlantıdan medya ekle', en: 'Embed media', hint: '↗', action: true },
  { id: 'templates', label: 'Şablon kütüphanesi', en: 'Templates', hint: '↗', action: true },
]
function paragraph(editor) {
  const range = currentRange(editor.root)
  if (!editor.editable || editor.composing || !range?.collapsed) return null
  const block = closestBlock(editor.root, range.startContainer)
  if (
    block?.tagName !== 'P' ||
    block.parentElement !== editor.root ||
    (block.children.length && [...block.children].some((c) => c.tagName !== 'BR'))
  )
    return null
  const tail = range.cloneRange()
  tail.selectNodeContents(block)
  tail.setStart(range.startContainer, range.startOffset)
  return tail.toString() ? null : block
}
export const productivity = {
  moveBlock(id, beforeId = null) {
    if (!this.editable || this.composing) return false
    const node = findBlock(this.root, id)
    const before = beforeId === null ? null : findBlock(this.root, beforeId)
    if (!node || (beforeId !== null && !before) || node === before || node.nextSibling === before)
      return false
    this.transaction(() => this.root.insertBefore(node, before), 'blockMove')
    return true
  },
  slashQuery() {
    const block = paragraph(this),
      text = block?.textContent
    if (
      !text ||
      !/^\/[^/\n]{0,60}$/.test(text) ||
      (this.dismissedSlash === block && this.dismissedSlashText === text)
    )
      return null
    return text.slice(1)
  },
  dismissSlash() {
    this.dismissedSlash = paragraph(this)
    this.dismissedSlashText = this.dismissedSlash?.textContent
    this.publishState()
  },
  writingBlock(id) {
    const block = paragraph(this)
    if (!block || !writingCommands.some((c) => c.id === id && !c.action)) return false
    this.transaction(() => {
      const next = this.doc.createElement(id === 'task' ? 'ul' : id.startsWith('style:') ? 'p' : id)
      if (id === 'task') next.dataset.studioTaskList = 'true'
      if (id.startsWith('style:')) next.dataset.studioStyle = id.slice(6)
      let caret = next
      if (id === 'ul' || id === 'ol' || id === 'task') {
        caret = this.doc.createElement('li')
        next.append(caret)
      }
      if (id === 'blockquote') {
        caret = this.doc.createElement('p')
        next.append(caret)
      }
      if (id === 'hr') {
        caret = this.doc.createElement('p')
        block.after(caret)
      }
      caret.append(this.doc.createElement('br'))
      block.replaceWith(next)
      caretInside(this.root, caret)
    }, 'writingShortcut')
    return true
  },
  markdownInput(event) {
    if (event.inputType !== 'insertText' || event.data !== ' ' || this.pending) return false
    const block = paragraph(this)
    if (!block) return false
    const text = block.textContent
    const id = /^#{1,3}$/.test(text)
      ? `h${text.length}`
      : {
          '-': 'ul',
          '*': 'ul',
          '1.': 'ol',
          '>': 'blockquote',
          '```': 'pre',
          '---': 'hr',
          '[]': 'task',
          '[ ]': 'task',
        }[text]
    if (!id) return false
    event.preventDefault()
    return this.writingBlock(id)
  },
  autoLink(event) {
    if (
      event.inputType !== 'insertText' ||
      !/\s/u.test(event.data || '') ||
      this.context()?.closest('a,pre,code')
    )
      return
    const range = currentRange(this.root),
      node = range?.startContainer
    if (!range?.collapsed || node.nodeType !== 3) return
    const prefix = node.data.slice(0, range.startOffset),
      match = prefix.match(/(?:^|\s)(https?:\/\/[^\s<>]+)(\s)$/u)
    if (!match) return
    const url = match[1]
    try {
      if (!new URL(url).hostname) return
    } catch {
      return
    }
    const start = prefix.length - url.length - match[2].length,
      caretOffset = range.startOffset
    const linkRange = this.doc.createRange()
    linkRange.setStart(node, start)
    linkRange.setEnd(node, start + url.length)
    const link = this.doc.createElement('a')
    link.href = url
    link.append(linkRange.extractContents())
    linkRange.insertNode(link)
    const tail = link.nextSibling
    if (tail?.nodeType === 3) {
      range.setStart(tail, caretOffset - start - url.length)
      range.collapse(true)
      selectRange(this.root, range)
    }
  },
}
