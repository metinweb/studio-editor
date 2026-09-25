import { cleanHtml, escapeHtml } from '../lib/content'
import { History } from './history'
import { captureBlocks, restoreBlockIds } from './identity.js'
import { diffText, selectionMap, mapSelection } from './operations.js'
import { safeMediaUrl } from '../lib/media-url'
import { preparePaste, finishPaste } from './clipboard'
import { features } from './features'
import { tableTools } from './table-tools'
import { tableStructure } from './table-structure'
import { tableFormat } from './table-format'
import { tableGrid } from './table-grid.js'
import { productivity } from './productivity.js'
import { suggestionTools } from './suggestions.js'
import { selectionColors } from './selection-colors.js'
import { mediaEmbeds } from './media-embeds.js'
import { dailyWriting } from './daily-writing.js'
import { normalizeWritingWidgets } from './writing-widgets.js'
import { readMediaEmbed, parseMediaEmbed } from '../lib/media-embed.js'
import { modelFromDOM } from './model-bridge.js'
import { renderModel, applyModelOperations } from './document-model.js'
import {
  bookmark,
  restore,
  currentRange,
  selectRange,
  closestBlock,
  selectedBlocks,
  textNodes,
  markRange,
  unwrap,
  elementAt,
  caretAfter,
  caretInside,
} from './selection'

const marks = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
  subscript: 'sub',
  superscript: 'sup',
}
const aliases = { b: 'strong', i: 'em', strike: 's' }
const inlineSelector = 'strong,b,em,i,u,s,strike,sub,sup,code,span'
const blockTags = /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|TABLE|HR|FIGURE)$/
const blank = (node) => !node.textContent.trim() && !node.querySelector('img,video,audio,table,hr')

export function safeLink(value) {
  const url = value.trim()
  if (!url || /[\u0000-\u0020]/.test(url)) return null
  return /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(url) ? url : null
}

export class StudioEditor {
  constructor(
    root,
    {
      content = '',
      blockIds = [],
      onChange = () => {},
      onState = () => {},
      onMedia = () => {},
      onSource = () => {},
      onSave = () => {},
      onFind = () => {},
      onFiles = () => {},
      onTransaction = () => {},
      onPaste = () => {},
      onNotice = () => {},
      onWritingKey = () => false,
      pasteMode = 'keep',
      tablePasteStyle = 'target',
      readonly = false,
      disabled = false,
    } = {},
  ) {
    this.root = root
    this.doc = root.ownerDocument
    this.callbacks = {
      onChange,
      onState,
      onMedia,
      onSource,
      onSave,
      onFind,
      onFiles,
      onTransaction,
      onPaste,
      onNotice,
      onWritingKey,
    }
    this.revision = 0
    this.pasteMode = pasteMode
    this.tablePasteStyle = tablePasteStyle
    this.listeners = []
    this.pending = null
    this.composing = false
    this.destroyed = false
    this.readonly = readonly
    this.disabled = disabled
    this.setHTML(content)
    restoreBlockIds(this.root, blockIds)
    this.history = new History(this.snapshot())
    this.setMode({ readonly, disabled })
    this.savedSelection = null
    this.listen(this.doc, 'selectionchange', () => this.selectionChanged())
    this.listen(root, 'beforeinput', (event) => this.beforeInput(event))
    this.listen(root, 'input', (event) => this.input(event))
    this.listen(root, 'keydown', (event) => this.keydown(event))
    this.listen(root, 'keyup', () => this.selectionChanged())
    this.listen(root, 'pointerdown', (event) => {
      if (!elementAt(event.target)?.closest('figure[data-studio-embed]')) this.selectedEmbed = null
      this.cellPointerDown(event)
    })
    this.listen(root, 'pointermove', (event) => this.cellPointerMove(event))
    this.listen(this.doc, 'pointerup', (event) => {
      if (event.button !== 0) return
      this.cellDrag = null
      if (this.cellSelection) {
        caretInside(this.root, this.cellSelection.anchor)
        this.rememberSelection()
        this.publishState()
      } else this.selectionChanged()
    })
    this.listen(this.doc, 'pointercancel', () => {
      this.cellDrag = null
    })
    this.listen(root, 'copy', (event) => this.cellClipboard(event))
    this.listen(root, 'compositionstart', () => {
      if (!this.editable) return
      this.composing = true
      this.before = this.snapshot()
      this.history.checkpoint(this.before)
      this.history.group = null
    })
    this.listen(root, 'compositionend', () => {
      if (!this.editable) return
      this.composing = false
      this.commit(this.before)
      this.before = null
    })
    this.listen(root, 'paste', (event) => this.paste(event))
    this.listen(root, 'cut', (event) => {
      if (!this.editable) event.preventDefault()
      else this.cellClipboard(event, true)
    })
    this.listen(root, 'dragover', (event) => {
      if (event.dataTransfer.types.includes('Files')) event.preventDefault()
    })
    this.listen(root, 'drop', (event) => this.drop(event))
    this.listen(root, 'dragstart', (event) => {
      if (event.target.tagName === 'IMG') event.preventDefault()
    })
    this.listen(root, 'click', (event) => {
      const taskControl = elementAt(event.target)?.closest('[data-studio-task-control]')
      if (taskControl) {
        event.preventDefault()
        this.toggleTask(taskControl.parentElement)
        return
      }
      if (elementAt(event.target)?.closest('a')) event.preventDefault()
      const embed = elementAt(event.target)?.closest('figure[data-studio-embed]')
      if (embed) {
        this.selectEmbed(embed)
        return
      }
      if (event.target.tagName === 'IMG') {
        this.selectImage(event.target)
        this.selectionChanged()
      }
    })
    this.publishState()
  }

  listen(target, type, callback) {
    target.addEventListener(type, callback)
    this.listeners.push(() => target.removeEventListener(type, callback))
  }
  destroy() {
    this.destroyed = true
    this.listeners.forEach((remove) => remove())
    this.listeners = []
  }
  getHTML() {
    return this.root.innerHTML
  }
  get editable() {
    return !this.readonly && !this.disabled && !this.destroyed
  }
  setMode({ readonly = false, disabled = false }) {
    // Finish text already entered by IME before revoking editing permission.
    if (this.composing && this.editable && (readonly || disabled)) {
      this.composing = false
      this.commit(this.before)
      this.before = null
    }
    this.readonly = readonly
    this.disabled = disabled
    this.pending = null
    this.cellSelection = null
    this.cellDrag = null
    this.root.contentEditable = String(this.editable)
    this.root.setAttribute('aria-readonly', String(readonly || disabled))
    this.root.setAttribute('aria-disabled', String(disabled))
    this.root.tabIndex = disabled ? -1 : 0
    if (disabled) this.root.blur()
  }
  snapshot() {
    const blocks = captureBlocks(this.root)
    return {
      html: this.getHTML(),
      selection: bookmark(this.root),
      blockIds: blocks.map((block) => block.id),
      blocks,
    }
  }
  publishTransaction(before, after, step, origin = 'local', kind = 'edit') {
    const transaction = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      baseRevision: this.revision,
      revision: ++this.revision,
      origin,
      kind,
      steps: [{ type: 'replaceHtml', ...step }],
      selectionBefore: structuredClone(before.selection),
      selectionAfter: structuredClone(after.selection),
      blockIdsBefore: [...before.blockIds],
      blockIdsAfter: [...after.blockIds],
      mapping: selectionMap(before.blocks, after.blocks),
    }
    this.callbacks.onTransaction(transaction)
  }
  getDocument() {
    return {
      schemaVersion: 1,
      revision: this.revision,
      html: this.getHTML(),
      blockIds: captureBlocks(this.root).map((block) => block.id),
    }
  }
  getModel() {
    return modelFromDOM(this.root, this.revision)
  }
  async refreshMedia(resolve) {
    const revision = this.revision
    const nodes = [...this.root.querySelectorAll('[data-studio-asset]')].filter((n) =>
      n.matches('img,video,audio,a'),
    )
    const ids = [...new Set(nodes.map((n) => n.dataset.studioAsset))]
    if (ids.length > 500) throw new Error('Bir seferde en fazla 500 medya adresi yenilenebilir.')
    const entries = await Promise.all(
      ids.map(async (id) => {
        const asset = await resolve(id),
          url = asset?.url || asset?.dataUrl
        if (asset?.id !== id || !safeMediaUrl(url || ''))
          throw new Error('Medya sağlayıcısı geçersiz bir dosya döndürdü.')
        return [id, url]
      }),
    )
    if (this.destroyed || this.revision !== revision) return false
    const urls = new Map(entries)
    this.transaction(
      () => {
        for (const node of nodes)
          if (this.root.contains(node)) {
            node.setAttribute(
              node.tagName === 'A' ? 'href' : 'src',
              urls.get(node.dataset.studioAsset),
            )
            if (node.tagName === 'IMG') {
              node.removeAttribute('srcset')
              node.removeAttribute('sizes')
            }
          }
      },
      'refreshMedia',
      true,
    )
    return true
  }
  applyOperations(transaction) {
    if (!this.editable) return false
    const next = applyModelOperations(this.getModel(), transaction)
    this.setModel(next, false)
    return true
  }
  setModel(model, external = true) {
    const html = renderModel(model)
    const position = bookmark(this.root),
      before = captureBlocks(this.root)
    const frame = this.doc.defaultView.frameElement
    const active = frame?.ownerDocument.activeElement
    const focused = frame ? active === frame : this.root.contains(this.doc.activeElement)
    let mapped
    this.transaction(
      () => {
        this.setHTML(html)
        restoreBlockIds(
          this.root,
          model.blocks.map((b) => b.id),
        )
        mapped = mapSelection(
          position || this.savedSelection,
          selectionMap(before, captureBlocks(this.root)),
        )
        if (focused) restore(this.root, mapped)
      },
      'model',
      external,
      false,
    )
    if (!focused) this.savedSelection = mapped
  }
  setHTML(html) {
    const cleaned = cleanHtml(html) || '<p><br></p>'
    if (this.root.innerHTML === cleaned) return
    this.root.innerHTML = cleaned
    for (const [oldTag, tag] of Object.entries(aliases)) {
      this.root.querySelectorAll(oldTag).forEach((node) => {
        const replacement = this.doc.createElement(tag)
        replacement.append(...node.childNodes)
        node.replaceWith(replacement)
      })
    }
    // Normalize root-level pasted text without rebuilding the document on keystrokes.
    let paragraph = null
    for (const node of [...this.root.childNodes]) {
      if (node.nodeType === 3 && !node.textContent.trim()) {
        node.remove()
        continue
      }
      if (node.nodeType === 1 && blockTags.test(node.tagName)) {
        paragraph = null
        continue
      }
      if (!paragraph) {
        paragraph = this.doc.createElement('p')
        node.before(paragraph)
      }
      paragraph.append(node)
    }
  }
  rememberSelection() {
    const position = bookmark(this.root)
    if (position) this.savedSelection = position
    return this.savedSelection
  }
  restoreSelection(position = this.savedSelection) {
    if (!this.disabled) this.root.focus({ preventScroll: true })
    return restore(this.root, position)
  }
  range() {
    return currentRange(this.root) || this.restoreSelection()
  }
  selectionChanged() {
    const position = bookmark(this.root)
    if (!position) return
    if (!this.context()?.closest('figure[data-studio-embed]')) this.selectedEmbed = null
    if (this.pending && JSON.stringify(position) !== this.pending.position) this.pending = null
    this.savedSelection = position
    this.publishState()
  }
  context() {
    const range = currentRange(this.root)
    // WebKit can clear Selection when a nested player finishes loading.
    // Retain the explicitly selected widget until a new document selection.
    if (!range) return this.root.contains(this.selectedEmbed) ? this.selectedEmbed : null
    const selectedNode =
      range.startContainer === range.endContainer &&
      range.endOffset === range.startOffset + 1 &&
      range.startContainer.nodeType === 1
        ? range.startContainer.childNodes[range.startOffset]
        : null
    return elementAt(selectedNode || range.startContainer)
  }
  activeMarks() {
    const element = this.context()
    return Object.fromEntries(
      Object.entries(marks).map(([name, tag]) => [name, !!element?.closest(tag)]),
    )
  }
  publishState() {
    const element = this.context()
    const block = element && closestBlock(this.root, element)
    const table = element?.closest('table')
    const model = tableGrid(table)
    const selectedCells = this.selectedCells(model)
    const link = element?.closest('a')
    const image = element?.closest('img')
    const range = currentRange(this.root)
    const firstText =
      range && !range.collapsed ? textNodes(this.root, range, 1)[0]?.parentElement : null
    const styleElement = firstText || element || this.root
    const typography = this.doc.defaultView.getComputedStyle(styleElement)
    const state = {
      taskList: !!element?.closest('ul[data-studio-task-list="true"]'),
      contentStyle: block?.dataset.studioStyle || '',
      mentionQuery: this.mentionQuery()?.query ?? null,
      mediaEmbed: readMediaEmbed(element?.closest('figure[data-studio-embed]')),
      slashQuery: this.slashQuery(),
      ...this.activeMarks(),
      ...(this.pending?.marks || {}),
      canUndo: this.sharedHistory ? this.sharedHistory.canUndo : this.history?.canUndo || false,
      canRedo: this.sharedHistory ? this.sharedHistory.canRedo : this.history?.canRedo || false,
      block: element?.closest('blockquote')
        ? 'blockquote'
        : /^(P|H[1-4]|PRE)$/.test(block?.tagName)
          ? block.tagName.toLowerCase()
          : 'p',
      align: block?.style.textAlign || 'left',
      fontFamily: this.pending?.styles?.fontFamily || typography.fontFamily,
      fontSize: this.pending?.styles?.fontSize || typography.fontSize,
      ...selectionColors(this.root, styleElement, typography, this.pending?.styles),
      list: element?.closest('ul,ol')?.tagName.toLowerCase() || '',
      table: !!table,
      selectedCellCount: selectedCells?.cells.length || 0,
      tableStyle: table?.dataset.studioTable || 'plain',
      selectedText: currentRange(this.root)?.toString().slice(0, 300) || '',
      ...this.tableCapabilities(model, selectedCells),
      complexTable:
        !!table && (!model || [...model.positions.values()].some((p) => p.w > 1 || p.h > 1)),
      link: link
        ? {
            href: link.getAttribute('href'),
            text: link.textContent,
            blank: link.target === '_blank',
          }
        : null,
      image: image
        ? { alt: image.alt, width: image.style.width || image.getAttribute('width') || '' }
        : null,
    }
    this.callbacks.onState(state)
    return state
  }
  commit(before, group = null) {
    if (!this.root.childNodes.length) this.root.innerHTML = '<p><br></p>'
    this.normalizeRoot()
    normalizeWritingWidgets(this.root)
    const caret = currentRange(this.root)
    if (
      caret?.collapsed &&
      caret.startContainer.nodeType === 1 &&
      caret.startContainer.matches('li') &&
      caret.startOffset === 0 &&
      caret.startContainer.firstChild?.hasAttribute?.('data-studio-task-control')
    ) {
      caret.setStart(caret.startContainer, 1)
      caret.collapse(true)
      selectRange(this.root, caret)
    }
    // An equivalent replacement must not silently invalidate history identities.
    if (
      !['model', 'blockMove'].includes(this.operationKind) &&
      this.getHTML() === this.history.current.html
    )
      restoreBlockIds(this.root, this.history.current.blockIds)
    const after = this.snapshot()
    const previous = before || this.history.current
    const step = this.history.commit(after, previous, group)
    if (!step) this.history.checkpoint(after)
    this.savedSelection = after.selection
    this.callbacks.onChange(after.html)
    this.publishState()
    if (step)
      this.publishTransaction(previous, after, step, 'local', group || this.operationKind || 'edit')
  }
  normalizeRoot() {
    const needsWrapping = [...this.root.childNodes].some(
      (node) => node.nodeType === 3 || (node.nodeType === 1 && !blockTags.test(node.tagName)),
    )
    if (!needsWrapping) return
    const range = currentRange(this.root)
    const selection = range ? markRange(this.root, range) : null
    let paragraph = null
    for (const node of [...this.root.childNodes]) {
      if (node.nodeType === 1 && blockTags.test(node.tagName)) {
        paragraph = null
        continue
      }
      if (!paragraph) {
        paragraph = this.doc.createElement('p')
        node.before(paragraph)
      }
      paragraph.append(node)
    }
    selection?.restore()
  }
  transaction(change, kind = 'command', external = false, focus = true) {
    if (!this.editable && !external) return
    this.rememberSelection()
    if (this.editable && focus) this.restoreSelection()
    const before = this.snapshot()
    this.history.checkpoint(before)
    this.pending = null
    this.operationKind = kind
    try {
      change(external && !this.editable ? null : focus ? this.range() : currentRange(this.root))
    } catch (cause) {
      this.root.innerHTML = before.html
      restoreBlockIds(this.root, before.blockIds)
      this.restoreSelection(before.selection)
      this.operationKind = null
      throw cause
    }
    // Unwrapping a now-empty style span can collapse a DOM Range anchored in
    // that span. Keep markers through cleanup so consecutive menu commands
    // still act on the same text selection.
    const range = currentRange(this.root)
    const frame = this.doc.defaultView.frameElement
    const focused = frame
      ? frame.ownerDocument.activeElement === frame
      : this.root.contains(this.doc.activeElement)
    const selection = range && (focus || focused) ? markRange(this.root, range) : null
    this.root.querySelectorAll(inlineSelector).forEach((node) => {
      if (node.hasAttribute('data-studio-marker') || node.hasAttribute('data-studio-task-control'))
        return
      if (
        !node.textContent &&
        !node.id &&
        !node.querySelector('br,img,video,audio,[data-studio-marker]')
      )
        node.remove()
      else if (node.tagName === 'SPAN' && !node.attributes.length) unwrap(node)
    })
    selection?.restore()
    this.cellSelection = null
    this.commit(before)
    this.operationKind = null
  }
  undo() {
    if (this.sharedHistory && this.editable) {
      this.sharedHistory.undo()
      return
    }
    this.travel(-1)
  }
  redo() {
    if (this.sharedHistory && this.editable) {
      this.sharedHistory.redo()
      return
    }
    this.travel(1)
  }
  travel(direction) {
    if (!this.editable) return
    this.cellSelection = null
    const before = this.snapshot()
    const snapshot = this.history.move(direction)
    if (!snapshot) return
    this.pending = null
    this.root.innerHTML = snapshot.html
    restoreBlockIds(this.root, snapshot.blockIds)
    this.restoreSelection(snapshot.selection)
    this.savedSelection = bookmark(this.root)
    this.callbacks.onChange(snapshot.html)
    this.publishState()
    this.publishTransaction(
      before,
      this.snapshot(),
      diffText(before.html, snapshot.html),
      direction < 0 ? 'undo' : 'redo',
      'history',
    )
  }
  replace(html, blockIds) {
    this.transaction(
      () => {
        this.setHTML(html)
        if (blockIds) restoreBlockIds(this.root, blockIds)
        if (this.editable) caretInside(this.root, this.root, true)
      },
      'replace',
      true,
    )
  }

  beforeInput(event) {
    if (!this.editable) {
      event.preventDefault()
      return
    }
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault()
      event.inputType === 'historyUndo' ? this.undo() : this.redo()
      return
    }
    if (this.composing || event.isComposing) return
    if (this.markdownInput(event)) return
    this.cellSelection = null
    this.before = this.snapshot()
    this.history.checkpoint(this.before)
    if (event.inputType === 'insertParagraph') {
      event.preventDefault()
      this.enter()
      return
    }
    if (event.inputType === 'insertLineBreak') {
      event.preventDefault()
      this.insert('<br>')
      return
    }
    const nativeFormat = {
      formatBold: 'bold',
      formatItalic: 'italic',
      formatUnderline: 'underline',
    }[event.inputType]
    if (nativeFormat) {
      event.preventDefault()
      this.inline(nativeFormat)
      return
    }
    if (this.pending && event.inputType === 'insertText' && event.data) {
      event.preventDefault()
      const pending = this.pending
      this.transaction((range) => {
        const boundary = markRange(this.root, range, true)
        const node = this.doc.createTextNode(event.data)
        let fragment = node
        for (const [name, enabled] of Object.entries(pending.marks))
          if (enabled) {
            const wrapper = this.doc.createElement(marks[name])
            wrapper.append(fragment)
            fragment = wrapper
          }
        if (pending.styles && Object.keys(pending.styles).length) {
          const wrapper = this.doc.createElement('span')
          Object.assign(wrapper.style, pending.styles)
          wrapper.append(fragment)
          fragment = wrapper
        }
        boundary.range.insertNode(fragment)
        boundary.restore()
        const caret = this.doc.createRange()
        caret.setStart(node, node.length)
        caret.collapse(true)
        selectRange(this.root, caret)
      })
    }
  }
  input(event) {
    if (!this.editable) {
      if (this.getHTML() !== this.history.current.html) {
        this.root.innerHTML = this.history.current.html
        restoreBlockIds(this.root, this.history.current.blockIds)
      }
      return
    }
    if (this.composing || event.isComposing) return
    const group = ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(
      event.inputType,
    )
      ? event.inputType
      : null
    this.autoLink(event)
    this.commit(this.before, group)
    this.before = null
  }
  keydown(event) {
    if (!this.editable) {
      // WebKit otherwise treats Backspace in a non-editable body as navigation.
      if (['Backspace', 'Delete', 'Enter'].includes(event.key)) event.preventDefault()
      if (
        (event.ctrlKey || event.metaKey) &&
        ['b', 'i', 'u', 'z', 'y', 's', 'f', 'v', 'x'].includes(event.key.toLowerCase())
      ) {
        event.preventDefault()
        if (!this.disabled && event.key.toLowerCase() === 'f') this.callbacks.onFind()
        if (!this.disabled && event.key.toLowerCase() === 's') this.callbacks.onSave()
      }
      return
    }
    if (event.isComposing || this.composing) return
    if (
      elementAt(event.target)?.matches('[data-studio-task-control]') &&
      [' ', 'Enter'].includes(event.key)
    ) {
      event.preventDefault()
      this.toggleTask(event.target.parentElement)
      return
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === 'Enter' &&
      this.context()?.closest('ul[data-studio-task-list="true"]')
    ) {
      event.preventDefault()
      this.toggleTask()
      return
    }
    if (this.embedKey(event)) return
    if (this.callbacks.onWritingKey(event)) return
    if (this.cellKey(event)) return
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && ['b', 'i', 'u', 'z', 'y', 's', 'f'].includes(key)) {
      event.preventDefault()
      if (key === 'z') event.shiftKey ? this.redo() : this.undo()
      else if (key === 'y') this.redo()
      else if (key === 's') this.callbacks.onSave()
      else if (key === 'f') {
        this.rememberSelection()
        this.callbacks.onFind()
      } else this.inline({ b: 'bold', i: 'italic', u: 'underline' }[key])
    }
    if (mod && key === 'v') this.plainPaste = event.shiftKey
    if (event.key === 'Tab') {
      if (this.context()?.closest('td,th')) {
        event.preventDefault()
        this.tableTab(event.shiftKey)
      } else if (this.context()?.closest('li')) {
        event.preventDefault()
        this.indent(event.shiftKey)
      } else if (this.context()?.closest('pre')) {
        event.preventDefault()
        this.insertText('  ')
      }
    }
  }

  inline(name, styles = null) {
    if (!this.editable) return
    this.restoreSelection()
    const range = this.range()
    if (range.collapsed) {
      const active = { ...this.activeMarks(), ...(this.pending?.marks || {}) }
      if (name) active[name] = !active[name]
      if (name === 'subscript' && active.subscript) active.superscript = false
      if (name === 'superscript' && active.superscript) active.subscript = false
      const inherited = {}
      for (let node = this.context(); node && node !== this.root; node = node.parentElement) {
        for (const property of ['color', 'backgroundColor', 'fontFamily', 'fontSize']) {
          if (!inherited[property] && node.style[property])
            inherited[property] = node.style[property]
        }
      }
      this.pending = {
        marks: active,
        styles: { ...inherited, ...this.pending?.styles, ...styles },
        position: JSON.stringify(bookmark(this.root)),
      }
      this.publishState()
      return
    }
    this.transaction((selection) => {
      const selectionMarkers = markRange(this.root, selection, true)
      const nodes = textNodes(this.root, selectionMarkers.range)
      const tag = marks[name]
      const remove = tag && nodes.every((node) => elementAt(node).closest(tag))
      const matching = new Set()
      for (const node of nodes) {
        for (
          let parent = node.parentElement;
          parent &&
          parent !== this.root &&
          !blockTags.test(parent.tagName) &&
          !['LI', 'TD', 'TH'].includes(parent.tagName);
          parent = parent.parentElement
        ) {
          if (tag && parent.tagName.toLowerCase() === tag) matching.add(parent)
          if (styles) {
            for (const key of Object.keys(styles)) parent.style[key] = ''
            if (!parent.getAttribute('style')) parent.removeAttribute('style')
          }
        }
      }
      for (const element of matching) unwrap(element)
      if (!remove)
        for (const node of nodes) {
          const wrapper = this.doc.createElement(tag || 'span')
          if (styles) Object.assign(wrapper.style, styles)
          node.replaceWith(wrapper)
          wrapper.append(node)
        }
      selectionMarkers.restore()
    })
  }
  clearFormat() {
    this.transaction((range) => {
      if (range.collapsed) return
      const selection = markRange(this.root, range, true)
      const elements = new Set()
      for (const node of textNodes(this.root, selection.range)) {
        for (
          let parent = node.parentElement;
          parent && parent.matches(inlineSelector);
          parent = parent.parentElement
        )
          elements.add(parent)
      }
      for (const element of elements)
        if (!element.hasAttribute('data-studio-thread')) unwrap(element)
      selection.restore()
    })
  }
  block(tag) {
    if (!['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre'].includes(tag)) return
    this.transaction((range) => {
      const blocks = selectedBlocks(this.root, range)
      const selection = markRange(this.root, range)
      for (const block of blocks) {
        if (tag === 'blockquote') {
          const quote = block.closest('blockquote')
          if (quote) unwrap(quote)
          else {
            const wrapper = this.doc.createElement('blockquote')
            block.replaceWith(wrapper)
            wrapper.append(block)
          }
        } else {
          const quote = block.closest('blockquote')
          if (quote) unwrap(quote)
          const replacement = this.doc.createElement(tag)
          if (block.getAttribute('style'))
            replacement.setAttribute('style', block.getAttribute('style'))
          replacement.append(...block.childNodes)
          if (['LI', 'TD', 'TH'].includes(block.tagName)) block.append(replacement)
          else block.replaceWith(replacement)
        }
      }
      selection.restore()
    })
  }
  align(value) {
    this.transaction((range) => {
      for (const block of selectedBlocks(this.root, range)) block.style.textAlign = value
    })
  }

  splitList(list, selected, tag) {
    let segment = null
    const fragment = this.doc.createDocumentFragment()
    const paragraphs = []
    for (const item of [...list.children]) {
      const chosen = selected.has(item)
      const kind = chosen ? tag : list.tagName.toLowerCase()
      if (!kind) {
        segment = null
        const paragraph = this.doc.createElement('p')
        paragraphs.push(paragraph)
        const nested = [...item.children].filter((child) => child.matches('ul,ol'))
        paragraph.append(...[...item.childNodes].filter((child) => !nested.includes(child)))
        fragment.append(paragraph, ...nested)
      } else {
        if (!segment || segment.tagName.toLowerCase() !== kind) {
          segment = this.doc.createElement(kind)
          if (kind === 'ul' && list.dataset.studioTaskList === 'true')
            segment.dataset.studioTaskList = 'true'
          fragment.append(segment)
        }
        segment.append(item)
      }
    }
    list.replaceWith(fragment)
    return paragraphs
  }
  list(tag) {
    this.transaction((range) => {
      const blocks = selectedBlocks(this.root, range)
      const selection = markRange(this.root, range)
      const handled = new Set()
      for (const block of blocks) {
        const item = block.closest('li')
        if (item) {
          const list = item.parentElement
          if (handled.has(list)) continue
          handled.add(list)
          const selected = new Set(
            blocks
              .map((block) => block.closest('li'))
              .filter((node) => node?.parentElement === list),
          )
          this.splitList(list, selected, list.tagName.toLowerCase() === tag ? null : tag)
        } else {
          const item = this.doc.createElement('li')
          item.append(...block.childNodes)
          const previous = block.previousElementSibling
          const list =
            previous?.tagName.toLowerCase() === tag ? previous : this.doc.createElement(tag)
          if (list !== previous) block.before(list)
          list.append(item)
          block.remove()
        }
      }
      selection.restore()
    })
  }
  indent(outdent = false) {
    this.transaction((range) => {
      const item = elementAt(range.startContainer)?.closest('li')
      if (!item) return
      const selection = markRange(this.root, range)
      const list = item.parentElement
      if (outdent) {
        const parentItem = list.parentElement.closest('li')
        if (parentItem) {
          parentItem.after(item)
          if (!list.children.length) list.remove()
        } else this.splitList(list, new Set([item]), null)
      } else if (item.previousElementSibling) {
        const previous = item.previousElementSibling
        let nested = [...previous.children].find((child) => child.tagName === list.tagName)
        if (!nested) {
          nested = this.doc.createElement(list.tagName)
          if (list.dataset.studioTaskList === 'true') nested.dataset.studioTaskList = 'true'
          previous.append(nested)
        }
        nested.append(item)
      }
      selection.restore()
    })
  }
  enter() {
    this.transaction((range) => {
      range.deleteContents()
      const block = closestBlock(this.root, range.startContainer)
      if (!block) {
        this.insertFragment('<p><br></p>', range)
        return
      }
      if (block.tagName === 'PRE') {
        this.insertFragment('\n', range, true)
        return
      }
      const item = elementAt(range.startContainer)?.closest('li')
      if (item && blank(item)) {
        const [paragraph] = this.splitList(item.parentElement, new Set([item]), null)
        if (paragraph) caretInside(this.root, paragraph)
        return
      }
      const current = item || block
      if (['TD', 'TH'].includes(current.tagName)) {
        this.insertFragment('<br>', range)
        return
      }
      const tailRange = this.doc.createRange()
      tailRange.setStart(range.startContainer, range.startOffset)
      tailRange.setEnd(current, current.childNodes.length)
      const tail = tailRange.extractContents()
      const next = this.doc.createElement(
        /^H[1-6]$/.test(current.tagName) && !tail.textContent ? 'p' : current.tagName,
      )
      if (current.style.textAlign) next.style.textAlign = current.style.textAlign
      next.append(tail)
      if (blank(next)) next.innerHTML = '<br>'
      if (blank(current)) current.innerHTML = '<br>'
      current.after(next)
      caretInside(this.root, next)
    })
  }

  insertFragment(html, range, plain = false) {
    range.deleteContents()
    const fragment = plain
      ? this.doc.createDocumentFragment()
      : range.createContextualFragment(cleanHtml(html))
    if (plain) fragment.append(this.doc.createTextNode(html))
    const last = fragment.lastChild
    if (!last) return
    const hasBlock = [...fragment.childNodes].some(
      (node) => node.nodeType === 1 && blockTags.test(node.tagName),
    )
    const block = closestBlock(this.root, range.startContainer)
    if (hasBlock && block && !['LI', 'TD', 'TH', 'PRE'].includes(block.tagName)) {
      const tailRange = this.doc.createRange()
      tailRange.setStart(range.startContainer, range.startOffset)
      tailRange.setEnd(block, block.childNodes.length)
      const tail = this.doc.createElement('p')
      tail.append(tailRange.extractContents())
      block.after(fragment)
      if (tail.childNodes.length) last.after(tail)
      if (blank(block)) block.remove()
    } else range.insertNode(fragment)
    caretAfter(this.root, last)
    if (last.nodeType === 1 && last.matches('p,h1,h2,h3,li')) caretInside(this.root, last, true)
    if (last.nodeType === 1 && last.tagName === 'IMG') this.selectImage(last)
  }
  insert(html) {
    this.transaction((range) => this.insertFragment(html, range))
  }
  insertText(text) {
    this.transaction((range) => this.insertFragment(text, range, true))
  }
  link({ href, text, blank: newWindow }) {
    const url = safeLink(href)
    if (!url) return false
    this.transaction((range) => {
      const existing = this.context()?.closest('a')
      if (existing && (range.collapsed || existing.textContent === range.toString())) {
        existing.setAttribute('href', url)
        if (text && existing.textContent !== text) existing.textContent = text
        existing.target = newWindow ? '_blank' : '_self'
        existing.rel = newWindow ? 'noopener noreferrer' : ''
      } else if (range.collapsed)
        this.insertFragment(
          `<a href="${escapeHtml(url)}"${newWindow ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(text || url)}</a>`,
          range,
        )
      else {
        const selection = markRange(this.root, range, true)
        const nodes = textNodes(this.root, selection.range)
        const oldLinks = new Set(
          nodes.map((node) => node.parentElement.closest('a')).filter(Boolean),
        )
        oldLinks.forEach(unwrap)
        for (const node of nodes) {
          const link = this.doc.createElement('a')
          link.href = url
          if (newWindow) {
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
          }
          node.replaceWith(link)
          link.append(node)
        }
        selection.restore()
      }
    })
    return true
  }
  unlink() {
    this.transaction((range) => {
      if (range.collapsed) {
        const link = this.context()?.closest('a')
        if (link) unwrap(link)
      } else {
        const selection = markRange(this.root, range, true)
        new Set(
          textNodes(this.root, selection.range)
            .map((node) => node.parentElement.closest('a'))
            .filter(Boolean),
        ).forEach(unwrap)
        selection.restore()
      }
    })
  }
  selectImage(image) {
    const range = this.doc.createRange()
    range.selectNode(image)
    selectRange(this.root, range)
    this.rememberSelection()
  }
  beginImageResize(image) {
    if (!this.editable) return null
    if (!image || !this.root.contains(image) || this.destroyed) return null
    this.selectImage(image)
    const before = this.snapshot()
    const rect = image.getBoundingClientRect()
    const parent = image.parentElement
    const style = this.doc.defaultView.getComputedStyle(parent)
    const available =
      parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    return {
      image,
      before,
      style: image.getAttribute('style'),
      width: rect.width,
      height: rect.height,
      ratio: rect.width / (rect.height || 1),
      maxWidth: Math.max(24, available),
    }
  }
  previewImageResize(session, width, height) {
    if (!this.editable) return
    if (this.destroyed || !this.root.contains(session.image)) return
    const nextWidth = Math.round(Math.max(24, Math.min(session.maxWidth, width)))
    session.image.style.width = `${nextWidth}px`
    session.image.style.height =
      height === undefined &&
      Math.abs(session.ratio - session.image.naturalWidth / session.image.naturalHeight) < 0.01
        ? 'auto'
        : `${Math.round(Math.max(24, Math.min(8192, height ?? nextWidth / session.ratio)))}px`
  }
  finishImageResize(session, cancel = false) {
    cancel ||= !this.editable
    if (this.destroyed || !this.root.contains(session.image)) return
    if (cancel) {
      if (session.style === null) session.image.removeAttribute('style')
      else session.image.setAttribute('style', session.style)
    }
    this.selectImage(session.image)
    if (!cancel && this.getHTML() !== session.before.html) {
      this.history.checkpoint(session.before)
      this.commit(session.before)
    } else this.publishState()
  }
  image({ alt, width, align }) {
    this.transaction(() => {
      const image = this.context()?.closest('img')
      if (!image) return
      if (alt !== undefined) image.alt = alt
      if (align) {
        image.style.display = 'block'
        image.style.marginLeft = align === 'left' ? '0' : 'auto'
        image.style.marginRight = align === 'right' ? '0' : 'auto'
      }
      if (width === undefined) return
      if (/^\d{1,4}(px|%)?$/.test(width)) {
        image.style.width = /[a-z%]/.test(width) ? width : `${width}px`
        image.style.height = 'auto'
      } else {
        image.style.removeProperty('width')
        image.removeAttribute('width')
      }
    })
  }
  replaceImageData(target, src, width) {
    if (!this.editable) return false
    if (!this.root.contains(target) || !safeMediaUrl(src)) return false
    this.selectImage(target)
    this.transaction(() => {
      const displayed = target.getBoundingClientRect().width
      target.src = src
      target.removeAttribute('srcset')
      target.removeAttribute('sizes')
      target.removeAttribute('width')
      target.removeAttribute('height')
      target.style.width = `${Math.round(Math.min(displayed || width, width))}px`
      target.style.height = 'auto'
      this.selectImage(target)
    })
    return true
  }
  removeImage() {
    this.transaction(() => {
      const image = this.context()?.closest('img')
      if (image) {
        caretAfter(this.root, image)
        image.remove()
      }
    })
  }
  insertTable(rows, columns, header = true) {
    const rowCount = Math.max(1, Math.min(20, Math.floor(Number(rows)) || 3))
    const columnCount = Math.max(1, Math.min(10, Math.floor(Number(columns)) || 3))
    this.transaction((range) => {
      const table = this.doc.createElement('table')
      table.style.width = '100%'
      const tbody = this.doc.createElement('tbody')
      table.append(tbody)
      for (let row = 0; row < rowCount; row++) {
        const tr = this.doc.createElement('tr')
        tbody.append(tr)
        for (let column = 0; column < columnCount; column++) {
          const cell = this.doc.createElement(header && row === 0 ? 'th' : 'td')
          if (cell.tagName === 'TH') cell.scope = 'col'
          cell.innerHTML = '<br>'
          tr.append(cell)
        }
      }
      this.insertFragment(`${table.outerHTML}<p><br></p>`, range)
      const tables = [...this.root.querySelectorAll('table')]
      const inserted =
        tables.find((table) => table.nextElementSibling === this.context()?.closest('p')) ||
        tables[tables.length - 1]
      if (inserted) caretInside(this.root, inserted.rows[0].cells[0])
    })
  }
  tableTab(backward) {
    const cell = this.context()?.closest('td,th')
    const cells = [...cell.closest('table').querySelectorAll('td,th')]
    const index = cells.indexOf(cell)
    const next = cells[index + (backward ? -1 : 1)]
    if (next) {
      caretInside(this.root, next)
      this.selectionChanged()
    } else if (!backward) {
      this.table('appendRow')
      const current = this.context()?.closest('tr')
      if (current?.cells[0]) caretInside(this.root, current.cells[0])
    }
  }

  prepareClipboard(data, mode = this.pasteMode) {
    try {
      return preparePaste(data, {
        mode,
        tablePasteStyle: this.tablePasteStyle,
        pre: !!this.context()?.closest('pre'),
        doc: this.doc,
      })
    } catch (error) {
      this.callbacks.onPaste({
        source: 'unknown',
        mode,
        rows: 0,
        columns: 0,
        warnings: [error.message],
        inserted: false,
      })
      return null
    }
  }
  insertPaste(prepared, media = []) {
    if (!this.editable || !prepared) return
    const result = finishPaste(prepared, media, this.doc)
    if (result.remaining?.length) result.html += result.remaining.map((item) => item.html).join('')
    if (this.pasteCells(result)) return
    let embedUrl = result.plain ? result.html : ''
    if (!result.plain && result.mode !== 'text') {
      const template = this.doc.createElement('template')
      template.innerHTML = result.html
      const link = template.content.querySelector('a')
      if (
        link &&
        !template.content.querySelector('figure,img,table,pre,code,video,audio') &&
        template.content.querySelectorAll('a').length === 1 &&
        template.content.textContent.trim() === link.getAttribute('href')
      )
        embedUrl = link.getAttribute('href')
    }
    if (
      result.mode !== 'text' &&
      this.range()?.collapsed &&
      !this.context()?.closest('a,pre,code,td,th') &&
      parseMediaEmbed(embedUrl)
    ) {
      this.insertEmbed(embedUrl)
      this.callbacks.onPaste({
        source: result.source,
        mode: result.mode,
        rows: 0,
        columns: 0,
        warnings: result.warnings,
        inserted: true,
      })
      return
    }
    if (
      result.plain &&
      result.mode !== 'text' &&
      /^https?:\/\/[^\s<>]+$/i.test(result.html) &&
      !this.context()?.closest('a,pre,code')
    ) {
      try {
        const url = new URL(result.html)
        if (url.hostname) {
          this.transaction((range) => {
            const link = this.doc.createElement('a')
            link.href = url.href
            if (range.collapsed) link.textContent = result.html
            else link.append(range.extractContents())
            range.insertNode(link)
            caretAfter(this.root, link)
          }, 'pasteLink')
          this.callbacks.onPaste({
            source: result.source,
            mode: result.mode,
            rows: 0,
            columns: 0,
            warnings: result.warnings,
            inserted: true,
          })
          return
        }
      } catch {}
    }
    if (result.html)
      this.transaction((range) => this.insertFragment(result.html, range, result.plain), 'paste')
    const { source, mode, rows, columns, warnings } = result
    this.callbacks.onPaste({ source, mode, rows, columns, warnings, inserted: !!result.html })
  }
  pasteContent(data, mode = this.pasteMode) {
    if (!this.editable) return
    this.insertPaste(this.prepareClipboard(data, mode))
  }
  paste(event) {
    event.preventDefault()
    const mode = this.plainPaste ? 'text' : this.pasteMode
    this.plainPaste = false
    if (!this.editable) return
    this.rememberSelection()
    const files = [...(event.clipboardData?.files || [])]
    const prepared = this.prepareClipboard(
      {
        html: event.clipboardData?.getData('text/html') || '',
        text: event.clipboardData?.getData('text/plain') || '',
      },
      mode,
    )
    if (!prepared) return
    // Browsers often expose the same image as both HTML and a file.
    const represented =
      !prepared.plain &&
      !prepared.placeholders &&
      /<img\b/i.test(prepared.html) &&
      files.every((file) => file.type.startsWith('image/'))
    if (files.length && prepared.mode !== 'text' && !represented)
      this.callbacks.onFiles(files, this.savedSelection, prepared)
    else this.insertPaste(prepared)
  }
  drop(event) {
    if (!this.editable) {
      event.preventDefault()
      return
    }
    const files = [...(event.dataTransfer?.files || [])]
    const html = event.dataTransfer?.getData('text/html')
    const text = event.dataTransfer?.getData('text/plain')
    if (!files.length && !html && !text) return
    event.preventDefault()
    const point = this.doc.caretPositionFromPoint?.(event.clientX, event.clientY)
    const range = point
      ? this.doc.createRange()
      : this.doc.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (point) {
      range.setStart(point.offsetNode, point.offset)
      range.collapse(true)
    }
    if (range && this.root.contains(range.startContainer)) selectRange(this.root, range)
    this.rememberSelection()
    if (files.length) this.callbacks.onFiles(files, this.savedSelection)
    else this.pasteContent({ html: html || '', text: text || '' })
  }

  matches(query, sensitive = false) {
    if (!query) return []
    const walker = this.doc.createTreeWalker(this.root, 4)
    const nodes = []
    let text = '',
      previousBlock
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        node.parentElement.closest(
          'figure[data-studio-embed],[data-studio-mention],[data-studio-task-control]',
        )
      )
        continue
      const block = closestBlock(this.root, node)
      if (previousBlock && block !== previousBlock) text += '\n'
      nodes.push({ node, offset: text.length })
      text += node.textContent
      previousBlock = block
    }
    const target = sensitive ? text : text.toLocaleLowerCase('tr')
    const search = sensitive ? query : query.toLocaleLowerCase('tr')
    const result = []
    for (
      let index = target.indexOf(search);
      index !== -1;
      index = target.indexOf(search, index + search.length)
    ) {
      const first = nodes.find(
        (item) => item.offset <= index && item.offset + item.node.length > index,
      )
      const last = nodes.find(
        (item) =>
          item.offset < index + search.length &&
          item.offset + item.node.length >= index + search.length,
      )
      if (!first || !last) continue
      const range = this.doc.createRange()
      range.setStart(first.node, index - first.offset)
      range.setEnd(last.node, index + search.length - last.offset)
      result.push(range)
    }
    return result
  }
  find(query, index = 0, sensitive = false) {
    const matches = this.matches(query, sensitive)
    if (!matches.length) return { count: 0, index: 0 }
    const position = ((index % matches.length) + matches.length) % matches.length
    this.root.focus({ preventScroll: true })
    selectRange(this.root, matches[position])
    this.rememberSelection()
    elementAt(matches[position].startContainer)?.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
    return { count: matches.length, index: position }
  }
  replaceMatches(query, replacement, all = false, sensitive = false) {
    this.transaction((range) => {
      const matches = all
        ? this.matches(query, sensitive)
        : [
            (
              sensitive
                ? range.toString() === query
                : range.toString().toLocaleLowerCase('tr') === query.toLocaleLowerCase('tr')
            )
              ? range
              : null,
          ].filter(Boolean)
      for (const match of matches.reverse()) {
        match.deleteContents()
        const node = this.doc.createTextNode(replacement)
        match.insertNode(node)
        caretAfter(this.root, node)
      }
    })
  }
}

Object.assign(StudioEditor.prototype, features)
Object.assign(StudioEditor.prototype, tableTools)
Object.assign(StudioEditor.prototype, tableStructure)
Object.assign(StudioEditor.prototype, tableFormat)
Object.assign(StudioEditor.prototype, productivity)
Object.assign(StudioEditor.prototype, suggestionTools)
Object.assign(StudioEditor.prototype, mediaEmbeds)
Object.assign(StudioEditor.prototype, dailyWriting)
