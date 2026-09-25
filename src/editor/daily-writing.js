import { currentRange, closestBlock, selectedBlocks, selectRange, markRange } from './selection'
import { normalizeWritingWidgets, contentStyles, validMention } from './writing-widgets.js'
export const dailyWriting = {
  taskList() {
    if (!this.editable) return
    this.transaction((range) => {
      const blocks = selectedBlocks(this.root, range)
      const marker = markRange(this.root, range)
      const lists = new Set()
      for (const block of blocks) {
        const item = block.closest('li')
        if (item) lists.add(item.parentElement)
        else if (block.matches('p,h1,h2,h3,h4,h5,h6,blockquote')) {
          let list = block.previousElementSibling
          if (!list?.matches('ul[data-studio-task-list="true"]')) {
            list = this.doc.createElement('ul')
            list.dataset.studioTaskList = 'true'
            block.before(list)
          }
          const li = this.doc.createElement('li')
          li.append(...block.childNodes)
          list.append(li)
          block.remove()
        }
      }
      for (const old of lists) {
        if (old.dataset.studioTaskList === 'true') old.removeAttribute('data-studio-task-list')
        else {
          const list = old.tagName === 'UL' ? old : this.doc.createElement('ul')
          if (list !== old) {
            list.append(...old.childNodes)
            old.replaceWith(list)
          }
          list.dataset.studioTaskList = 'true'
        }
      }
      normalizeWritingWidgets(this.root)
      marker.restore()
    }, 'taskList')
  },
  toggleTask(item = this.context()?.closest('li')) {
    if (
      !this.editable ||
      !item?.parentElement?.matches('ul[data-studio-task-list="true"]') ||
      !this.root.contains(item)
    )
      return false
    const control = item.querySelector(':scope > [data-studio-task-control]')
    const keyboardFocus = this.doc.activeElement === control
    this.transaction(() => {
      item.dataset.studioChecked = String(item.dataset.studioChecked !== 'true')
    }, 'toggleTask')
    if (keyboardFocus) control?.focus({ preventScroll: true })
    return true
  },
  applyContentStyle(id) {
    if (!this.editable || !contentStyles.some((s) => s.id === id)) return
    this.transaction((range) => {
      for (const node of selectedBlocks(this.root, range)) {
        if (!node.matches('p,h1,h2,h3,h4,h5,h6,blockquote,li')) continue
        if (id) node.dataset.studioStyle = id
        else node.removeAttribute('data-studio-style')
      }
    }, 'contentStyle')
  },
  mentionQuery() {
    const range = currentRange(this.root)
    if (
      !this.editable ||
      this.composing ||
      !range?.collapsed ||
      range.startContainer.nodeType !== 3
    )
      return null
    const node = range.startContainer
    if (node.parentElement.closest('a,pre,code,[data-studio-mention],figure[data-studio-embed]'))
      return null
    const match = /(?:^|\s)@([^@\n]{0,60})$/u.exec(node.data.slice(0, range.startOffset))
    if (!match) return null
    const key = `${range.startOffset}:${match[1]}`
    if (this.dismissedMention?.node === node && this.dismissedMention.key === key) return null
    return {
      query: match[1],
      node,
      from: range.startOffset - match[1].length - 1,
      to: range.startOffset,
      key,
    }
  },
  dismissMention() {
    const query = this.mentionQuery()
    this.dismissedMention = query && { node: query.node, key: query.key }
    this.publishState()
  },
  insertMention(item) {
    const query = this.mentionQuery()
    if (!query || !validMention(item?.id, item?.label)) return false
    this.transaction(() => {
      const range = this.doc.createRange()
      range.setStart(query.node, query.from)
      range.setEnd(query.node, query.to)
      range.deleteContents()
      const span = this.doc.createElement('span')
      span.dataset.studioMention = item.id
      span.dataset.studioMentionLabel = item.label
      span.contentEditable = 'false'
      span.textContent = `@${item.label}`
      range.insertNode(span)
      const space = this.doc.createTextNode('\u00a0')
      span.after(space)
      range.setStart(space, 1)
      range.collapse(true)
      selectRange(this.root, range)
    }, 'mention')
    return true
  },
  prepareSlashAction() {
    if (this.slashQuery() === null) return false
    const block = closestBlock(this.root, this.range().startContainer)
    this.dismissedSlash = block
    this.dismissedSlashText = block.textContent
    const range = this.doc.createRange()
    range.selectNodeContents(block)
    selectRange(this.root, range)
    this.rememberSelection()
    this.publishState()
    return true
  },
}
