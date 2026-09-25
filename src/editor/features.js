import { markRange, textNodes, selectRange, caretInside, unwrap } from './selection'
import { escapeHtml } from '../lib/content'

const annotation = '[data-studio-thread]'
function readThread(node) {
  try {
    const value = JSON.parse(node.dataset.studioThread)
    if (typeof value.id !== 'string' || !Array.isArray(value.messages)) return null
    return {
      id: value.id,
      resolved: value.resolved === true,
      messages: value.messages
        .filter((m) => typeof m.text === 'string')
        .map((m) => ({ text: m.text.slice(0, 4000), date: Number(m.date) || 0 })),
    }
  } catch {
    return null
  }
}
function annotate(node, thread) {
  node.dataset.studioThread = JSON.stringify(thread)
  node.dataset.studioResolved = String(thread.resolved)
}
function simpleTable(editor) {
  const table = editor.context()?.closest('table')
  if (
    !table ||
    table.querySelector('table,[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])')
  )
    return null
  const width = table.rows[0]?.cells.length
  return width && [...table.rows].every((row) => row.cells.length === width) ? table : null
}

export const features = {
  tableProperties({ caption, width, style }) {
    this.transaction(() => {
      const table = this.context()?.closest('table')
      if (!table) return
      if (/^\d{1,4}(px|%)?$/.test(width))
        table.style.width = /[a-z%]/.test(width) ? width : `${width}px`
      if (['plain', 'striped', 'minimal'].includes(style)) table.dataset.studioTable = style
      if (caption.trim()) table.createCaption().textContent = caption.trim()
      else table.caption?.remove()
    })
  },
  beginTableResize(table) {
    if (!this.editable) return null
    if (!table || !this.root.contains(table)) return null
    this.rememberSelection()
    const parent = table.parentElement
    const style = this.doc.defaultView.getComputedStyle(parent)
    return {
      table,
      before: this.snapshot(),
      style: table.getAttribute('style'),
      width: table.getBoundingClientRect().width,
      maxWidth: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    }
  },
  previewTableResize(session, width) {
    if (!this.editable) return
    if (session?.table.isConnected && !this.destroyed)
      session.table.style.width = `${Math.round(Math.max(80, Math.min(session.maxWidth, width)))}px`
  },
  finishTableResize(session, cancel = false) {
    cancel ||= !this.editable
    if (this.destroyed || !session?.table.isConnected) return
    if (cancel) {
      if (session.style === null) session.table.removeAttribute('style')
      else session.table.setAttribute('style', session.style)
    }
    this.restoreSelection(session.before.selection)
    if (!cancel && this.getHTML() !== session.before.html) {
      this.history.checkpoint(session.before)
      this.commit(session.before)
    } else this.publishState()
  },
  threads() {
    const threads = new Map()
    for (const node of this.root.querySelectorAll(annotation)) {
      const thread = readThread(node)
      if (!thread) continue
      if (!threads.has(thread.id)) threads.set(thread.id, { ...thread, quote: '' })
      threads.get(thread.id).quote += node.textContent
    }
    return [...threads.values()]
  },
  addComment(text) {
    if (!text.trim()) return false
    this.restoreSelection()
    const range = this.range()
    if (range.collapsed || !range.toString().trim()) return false
    // Overlapping discussions are deliberately avoided: each passage has one thread.
    if (textNodes(this.root, range).some((node) => node.parentElement.closest(annotation)))
      return false
    const thread = {
      id: crypto.randomUUID(),
      resolved: false,
      messages: [{ text: text.trim().slice(0, 4000), date: Date.now() }],
    }
    this.transaction((range) => {
      const selection = markRange(this.root, range, true)
      for (const node of textNodes(this.root, selection.range)) {
        const span = this.doc.createElement('span')
        annotate(span, thread)
        node.replaceWith(span)
        span.append(node)
      }
      selection.restore()
    })
    return true
  },
  updateComment(id, action, text = '') {
    this.transaction(() => {
      for (const node of [...this.root.querySelectorAll(annotation)]) {
        const thread = readThread(node)
        if (!thread || thread.id !== id) continue
        if (action === 'delete') {
          unwrap(node)
          continue
        }
        if (action === 'reply' && text.trim())
          thread.messages.push({ text: text.trim().slice(0, 4000), date: Date.now() })
        if (action === 'resolve') thread.resolved = !thread.resolved
        annotate(node, thread)
      }
    })
  },
  focusComment(id) {
    const nodes = [...this.root.querySelectorAll(annotation)].filter(
      (node) => readThread(node)?.id === id,
    )
    if (!nodes.length) return
    const range = this.doc.createRange()
    range.setStartBefore(nodes[0])
    range.setEndAfter(nodes.at(-1))
    this.root.focus({ preventScroll: true })
    selectRange(this.root, range)
    nodes[0].scrollIntoView({ block: 'center' })
    this.selectionChanged()
  },
  changeCase(mode) {
    this.transaction((range) => {
      if (range.collapsed) return
      const selection = markRange(this.root, range, true)
      for (const node of textNodes(this.root, selection.range)) {
        node.textContent =
          mode === 'upper'
            ? node.textContent.toLocaleUpperCase('tr')
            : node.textContent.toLocaleLowerCase('tr')
      }
      selection.restore()
    })
  },
  copyFormat() {
    const element = this.context()
    if (!element) return null
    const style = this.doc.defaultView.getComputedStyle(element)
    const keys = [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'textDecoration',
      'color',
      'backgroundColor',
    ]
    return Object.fromEntries(keys.map((key) => [key, style[key]]))
  },
  applyFormat(styles) {
    if (styles) this.inline(null, styles)
  },
  tableSort(direction) {
    this.transaction(() => {
      const table = simpleTable(this)
      const index = this.context()?.closest('td,th')?.cellIndex
      if (!table || index === undefined) return
      const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' })
      const selected = this.context().closest('td,th')
      // Keep header rows and section boundaries in place.
      for (const section of table.tBodies) {
        let run = []
        const flush = () => {
          if (run.length < 2) {
            run = []
            return
          }
          const marker = this.doc.createComment('sort')
          run[0].before(marker)
          run.sort(
            (a, b) =>
              collator.compare(
                a.cells[index].textContent.trim(),
                b.cells[index].textContent.trim(),
              ) * direction,
          )
          for (const row of run) marker.before(row)
          marker.remove()
          run = []
        }
        for (const row of [...section.rows]) {
          if (row.querySelector('th')) flush()
          else run.push(row)
        }
        flush()
      }
      caretInside(this.root, selected)
    })
  },
  tableAppearance(style) {
    this.transaction(() => {
      const table = this.context()?.closest('table')
      if (!table || !['plain', 'striped', 'minimal'].includes(style)) return
      table.dataset.studioTable = style
    })
  },
  contents() {
    this.transaction((range) => {
      const headings = [...this.root.querySelectorAll('h1,h2,h3')].filter(
        (h) => !h.closest('[data-studio-toc]'),
      )
      if (!headings.length) return
      const idCounts = new Map()
      this.root
        .querySelectorAll('[id]')
        .forEach((node) => idCounts.set(node.id, (idCounts.get(node.id) || 0) + 1))
      for (const heading of headings) {
        if (!heading.id || idCounts.get(heading.id) > 1)
          heading.id = `heading-${crypto.randomUUID()}`
      }
      const html = `<div data-studio-toc="true" class="studio-toc"><p><strong>İçindekiler</strong></p><ul>${headings.map((h) => `<li style="margin-left:${(Number(h.tagName[1]) - 1) * 16}px"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.textContent)}</a></li>`).join('')}</ul></div>`
      const existing = this.root.querySelector('[data-studio-toc]')
      if (existing) {
        const holder = this.doc.createElement('div')
        holder.innerHTML = html
        const replacement = holder.firstElementChild
        existing.replaceWith(replacement)
        caretInside(this.root, replacement)
      } else this.insertFragment(html, range)
    })
  },
  accessibilityIssues() {
    const issues = []
    const add = (node, type, title, help) => issues.push({ node, type, title, help })
    this.root.querySelectorAll('img').forEach((node) => {
      if (!node.hasAttribute('alt'))
        add(
          node,
          'alt',
          'Görsel açıklaması eksik',
          'Görseli açıklayın; yalnızca dekoratifse boş bırakın.',
        )
    })
    this.root.querySelectorAll('a').forEach((node) => {
      if (
        !node.textContent.trim() &&
        !node.querySelector('img[alt]:not([alt=""])') &&
        !node.getAttribute('aria-label')
      )
        add(
          node,
          'link',
          'Bağlantının erişilebilir adı yok',
          'Bağlantının amacını anlatan bir metin yazın.',
        )
    })
    this.root.querySelectorAll('table').forEach((node) => {
      if (!node.querySelector('th'))
        add(node, 'header', 'Tabloda başlık hücresi yok', 'İlk satırı başlık olarak işaretleyin.')
    })
    let level = 0
    this.root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((node) => {
      if (node.closest('[data-studio-toc]')) return
      const current = Number(node.tagName[1])
      if (level && current > level + 1)
        add(
          node,
          'heading',
          'Başlık düzeyi atlanmış',
          `Önceki başlık H${level}; bu başlığı H${level + 1} yapın.`,
        )
      if (!node.textContent.trim())
        add(
          node,
          'empty-heading',
          'Boş başlık',
          'Başlığa açıklayıcı bir metin ekleyin veya boş başlığı kaldırın.',
        )
      level = current
    })
    return issues
  },
  focusIssue(issue) {
    if (!this.root.contains(issue.node)) return
    this.root.focus({ preventScroll: true })
    caretInside(this.root, issue.node)
    issue.node.scrollIntoView({ block: 'center' })
    this.selectionChanged()
  },
  fixIssue(issue, value) {
    if (!this.root.contains(issue.node)) return
    this.transaction(() => {
      const node = issue.node
      if (issue.type === 'alt') node.setAttribute('alt', value.trim())
      if (issue.type === 'link' && value.trim()) {
        if (node.children.length) node.setAttribute('aria-label', value.trim())
        else node.textContent = value.trim()
      }
      if (issue.type === 'header') {
        for (const cell of [...(node.rows[0]?.cells || [])]) {
          const th = this.doc.createElement('th')
          for (const attr of cell.attributes) th.setAttribute(attr.name, attr.value)
          th.scope = 'col'
          th.append(...cell.childNodes)
          cell.replaceWith(th)
        }
      }
      this.root.focus({ preventScroll: true })
      caretInside(this.root, node)
    })
  },
}
