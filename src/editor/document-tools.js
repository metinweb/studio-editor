import { closestBlock, selectRange, markRange, textNodes } from './selection'
import { validAnchor, validField, normalizeDocumentFields } from './document-fields.js'
import { escapeHtml } from '../lib/content'

export const documentTools = {
  setAnchor(id, previous = '') {
    if (!validAnchor(id)) return false
    const existing = [...this.root.querySelectorAll('[id]')].find((node) => node.id === id)
    const target = previous
      ? [...this.root.querySelectorAll('[id]')].find((node) => node.id === previous)
      : closestBlock(this.root, this.formattingRange(this.range()).startContainer)
    if (
      !target ||
      (existing && existing !== target) ||
      target.closest('[data-studio-footnotes], [data-studio-footnote-ref]')
    )
      return false
    this.transaction(() => {
      const old = target.id
      target.id = id
      target.dataset.studioAnchor = 'true'
      if (old)
        for (const link of this.root.querySelectorAll('a[href]'))
          if (link.getAttribute('href') === `#${old}`) link.setAttribute('href', `#${id}`)
    }, 'anchor')
    return true
  },
  removeAnchor(id) {
    const node = [...this.root.querySelectorAll('[data-studio-anchor]')].find(
      (node) => node.id === id,
    )
    if (node)
      this.transaction(() => {
        node.removeAttribute('id')
        node.removeAttribute('data-studio-anchor')
      }, 'anchor')
  },
  footnote(text, id = '') {
    if (!text.trim() || text.length > 4000) return false
    const note =
      id &&
      [...this.root.querySelectorAll('li[data-studio-footnote]')].find((node) => node.id === id)
    if (id && !note) return false
    this.transaction((range) => {
      if (note) {
        note.innerHTML = `<p>${escapeHtml(text)}</p>`
      } else {
        if (closestBlock(this.root, range.startContainer)?.closest('[data-studio-footnotes]'))
          return
        const key = `fn-${crypto.randomUUID()}`
        range.collapse(false)
        const sup = this.doc.createElement('sup')
        sup.dataset.studioFootnoteRef = key
        sup.innerHTML = `<a href="#${key}">1</a>`
        range.insertNode(sup)
        let section = this.root.querySelector('[data-studio-footnotes]')
        if (!section) {
          section = this.doc.createElement('div')
          section.dataset.studioFootnotes = 'true'
          section.innerHTML = '<hr><ol></ol>'
          this.root.append(section)
        }
        const li = this.doc.createElement('li')
        li.id = key
        li.dataset.studioFootnote = 'true'
        li.innerHTML = `<p>${escapeHtml(text)}</p>`
        section.querySelector('ol').append(li)
        range.setStartAfter(sup)
        range.collapse(true)
        selectRange(this.root, range)
      }
      normalizeDocumentFields(this.root)
    }, 'footnote')
    return true
  },
  removeFootnote(id) {
    this.transaction(() => {
      for (const ref of this.root.querySelectorAll('[data-studio-footnote-ref]'))
        if (ref.dataset.studioFootnoteRef === id) ref.remove()
      for (const note of this.root.querySelectorAll('li[data-studio-footnote]'))
        if (note.id === id) note.remove()
      normalizeDocumentFields(this.root, true)
    }, 'footnote')
  },
  insertField(key) {
    if (!validField(key)) return false
    this.insert(`<span data-studio-field="${escapeHtml(key)}">{{${escapeHtml(key)}}}</span>&nbsp;`)
    return true
  },
  fillFields(values) {
    this.transaction(() => {
      for (const field of this.root.querySelectorAll('[data-studio-field]')) {
        const key = field.dataset.studioField
        if (Object.hasOwn(values, key))
          field.replaceWith(this.doc.createTextNode(String(values[key]).slice(0, 10000)))
      }
    }, 'fillFields')
  },
  typography() {
    this.transaction((range) => {
      const selected = range.collapsed ? null : markRange(this.root, range, true)
      const scope = selected?.range || this.doc.createRange()
      if (!selected) scope.selectNodeContents(this.root)
      for (const node of textNodes(this.root, scope)) {
        if (node.parentElement.closest('code,pre,a,[data-studio-field],[data-studio-footnote-ref]'))
          continue
        node.data = node.data
          .replace(/\(c\)/gi, '©')
          .replace(/\(r\)/gi, '®')
          .replace(/\(tm\)/gi, '™')
          .replace(/\.\.\./g, '…')
          .replace(/\s--\s/g, ' — ')
          .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
          .replace(/"([^"\n]+)"/g, '“$1”')
      }
      selected?.restore()
    }, 'typography')
  },
}
