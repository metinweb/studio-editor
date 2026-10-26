import { currentRange, selectRange, elementAt, closestBlock, caretInside } from './selection'
import { diffText } from './operations.js'

// Track changes: while enabled, typing becomes <ins> suggestions and deletions become <del>
// suggestions; Enter and Backspace across paragraphs become split/join suggestions.
// Each change carries an id, author and time. Accepting or rejecting is an undoable edit.
export const changeSelector = '[data-studio-change]'
const insertSelector = 'ins[data-studio-change="insert"]'
const deleteSelector = 'del[data-studio-change="delete"]'
const atomicSelector = 'img,br,hr,video,audio,[contenteditable="false"]'
const mergeableBlocks = /^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/
export const trackedNotice =
  'Değişiklik izleme açık: yalnızca metin ekleme ve silme önerilebilir. Biçim ve yapı değişiklikleri için izlemeyi kapatın.'
const metaAttributes = [
  'data-studio-change',
  'data-studio-change-id',
  'data-studio-author',
  'data-studio-author-name',
  'data-studio-time',
]

function clearMeta(node) {
  for (const name of metaAttributes) node.removeAttribute(name)
}
function unwrapElement(node) {
  node.replaceWith(...node.childNodes)
}
function mergeIntoPrevious(block) {
  const previous = block.previousElementSibling
  if (
    !previous ||
    !mergeableBlocks.test(previous.tagName) ||
    !mergeableBlocks.test(block.tagName)
  ) {
    clearMeta(block)
    return
  }
  if (!previous.textContent && !previous.querySelector(atomicSelector.replace('br,', '')))
    previous.replaceChildren()
  else if (previous.lastChild?.nodeName === 'BR') previous.lastChild.remove()
  const empty = !block.textContent && !block.querySelector(atomicSelector.replace('br,', ''))
  if (!empty) previous.append(...block.childNodes)
  if (!previous.childNodes.length) previous.innerHTML = '<br>'
  block.remove()
}
function resolveNode(node, accept) {
  const type = node.getAttribute('data-studio-change')
  if (type === 'insert') accept ? unwrapElement(node) : node.remove()
  else if (type === 'delete') accept ? node.remove() : unwrapElement(node)
  else if (type === 'split') accept ? clearMeta(node) : mergeIntoPrevious(node)
  else if (type === 'join') accept ? mergeIntoPrevious(node) : clearMeta(node)
  else clearMeta(node)
}
/** Accepts or rejects tracked changes in any DOM tree; `filter` limits the nodes. */
export function resolveChanges(root, accept, filter = () => true) {
  // Inline changes first, so block merges move already-resolved content.
  const nodes = [...root.querySelectorAll(changeSelector)].sort(
    (a, b) => Number(/^(INS|DEL)$/.test(b.tagName)) - Number(/^(INS|DEL)$/.test(a.tagName)),
  )
  for (const node of nodes) if (root.contains(node) && filter(node)) resolveNode(node, accept)
}
export function normalizeTrackedChanges(root) {
  for (const node of root.querySelectorAll(`${insertSelector},${deleteSelector}`))
    if (!node.textContent && !node.querySelector(atomicSelector)) node.remove()
}

function splitBoundaries(range) {
  if (range.startContainer.nodeType === 3 && range.startContainer === range.endContainer) {
    const text = range.startContainer
    const { startOffset, endOffset } = range
    const middle = startOffset > 0 ? text.splitText(startOffset) : text
    if (endOffset - startOffset < middle.length) middle.splitText(endOffset - startOffset)
    range.setStart(middle, 0)
    range.setEnd(middle, endOffset - startOffset)
    return
  }
  if (range.endContainer.nodeType === 3 && range.endOffset < range.endContainer.length)
    range.endContainer.splitText(range.endOffset)
  if (range.startContainer.nodeType === 3 && range.startOffset > 0) {
    const tail = range.startContainer.splitText(range.startOffset)
    range.setStart(tail, 0)
  }
}
function leafNodes(range) {
  const root =
    range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentNode
  const nodes = []
  const walker = root.ownerDocument.createTreeWalker(root, 5, {
    acceptNode: (node) =>
      node.nodeType === 3 || node.matches(atomicSelector) ? 1 : 3 /* skip, keep children */,
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if (range.intersectsNode(node) && (node.nodeType !== 3 || node.length)) nodes.push(node)
  // Atomic widgets are deleted as a whole, without their inner text.
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains?.(node)))
}

export const trackChangeTools = {
  setTrackChanges(enabled) {
    this.trackChanges = !!enabled
    this.pending = null
    this.publishState()
  },
  changeMeta(type, id = crypto.randomUUID()) {
    return {
      type,
      id,
      author: String(this.user?.id || 'local').slice(0, 100),
      name: String(this.user?.name || '').slice(0, 100),
      time: new Date().toISOString(),
    }
  },
  changeElement(tag, meta) {
    const node = this.doc.createElement(tag)
    this.applyMeta(node, meta)
    return node
  },
  applyMeta(node, meta) {
    node.setAttribute('data-studio-change', meta.type)
    node.setAttribute('data-studio-change-id', meta.id)
    node.setAttribute('data-studio-author', meta.author)
    if (meta.name) node.setAttribute('data-studio-author-name', meta.name)
    node.setAttribute('data-studio-time', meta.time)
  },
  ownChange(node, selector) {
    const change = elementAt(node)?.closest?.(selector)
    return change &&
      this.root.contains(change) &&
      change.getAttribute('data-studio-author') === String(this.user?.id || 'local')
      ? change
      : null
  },
  /** Wraps the range as deleted (or really removes own insertions). Returns the touched ends. */
  markDeleted(range, meta = this.changeMeta('delete')) {
    splitBoundaries(range)
    let first = null,
      last = null
    for (const node of leafNodes(range)) {
      const ownInsert = this.ownChange(node, insertSelector)
      if (ownInsert) {
        const marker = this.doc.createTextNode('')
        node.replaceWith(marker)
        first ||= marker
        last = marker
        continue
      }
      const deleted = elementAt(node)?.closest?.(deleteSelector)
      if (deleted && this.root.contains(deleted)) {
        first ||= node
        last = node
        continue
      }
      const previous = node.previousSibling,
        next = node.nextSibling
      const author = String(this.user?.id || 'local')
      const adjacent = [previous, next].find(
        (sibling) =>
          sibling?.nodeType === 1 &&
          sibling.matches(deleteSelector) &&
          sibling.getAttribute('data-studio-author') === author,
      )
      if (adjacent === previous) adjacent.append(node)
      else if (adjacent === next) adjacent.prepend(node)
      else {
        const wrapper = this.changeElement('del', { ...meta, type: 'delete' })
        node.replaceWith(wrapper)
        wrapper.append(node)
      }
      first ||= node
      last = node
    }
    return { first, last }
  },
  /** Inserts tracked text at a collapsed range and leaves the caret after it. */
  insertTrackedText(range, text, meta = null) {
    const deleted = elementAt(range.startContainer)?.closest?.(deleteSelector)
    if (deleted && this.root.contains(deleted)) {
      let outer = deleted
      while (outer.parentElement?.closest(deleteSelector))
        outer = outer.parentElement.closest(deleteSelector)
      range.setStartAfter(outer)
      range.collapse(true)
    }
    let own = this.ownChange(range.startContainer, insertSelector)
    if (!own && range.startContainer.nodeType === 1) {
      const before = range.startContainer.childNodes[range.startOffset - 1]
      if (
        before?.nodeType === 1 &&
        before.matches(insertSelector) &&
        this.ownChange(before, insertSelector)
      ) {
        own = before
        range.selectNodeContents(own)
        range.collapse(false)
      }
    }
    if (
      !own &&
      range.startContainer.nodeType === 3 &&
      range.startOffset === range.startContainer.length
    ) {
      const parent = range.startContainer.parentElement
      if (parent?.matches(insertSelector) && this.ownChange(parent, insertSelector)) own = parent
    }
    const lines = text.split('\n')
    const caret = this.doc.createRange()
    if (
      own &&
      !meta &&
      lines.length === 1 &&
      range.startContainer.nodeType === 3 &&
      own.contains(range.startContainer)
    ) {
      range.startContainer.insertData(range.startOffset, text)
      caret.setStart(range.startContainer, range.startOffset + text.length)
    } else {
      const nodes = []
      lines.forEach((line, index) => {
        if (index) nodes.push(this.doc.createElement('br'))
        if (line) nodes.push(this.doc.createTextNode(line))
      })
      if (!nodes.length) return
      const holder =
        own && !meta ? null : this.changeElement('ins', meta || this.changeMeta('insert'))
      const fragment = this.doc.createDocumentFragment()
      fragment.append(...nodes)
      if (holder) {
        holder.append(fragment)
        range.insertNode(holder)
      } else range.insertNode(fragment)
      const end = nodes.at(-1)
      if (end.nodeType === 3) caret.setStart(end, end.length)
      else caret.setStartAfter(end)
    }
    caret.collapse(true)
    selectRange(this.root, caret)
  },
  trackedInsert(range, text) {
    this.transaction(() => {
      let meta = null
      if (!range.collapsed) {
        // A replacement: the deletion and the insertion share one change id.
        meta = this.changeMeta('insert')
        const { last } = this.markDeleted(range, { ...meta, type: 'delete' })
        if (last) {
          const deleted = elementAt(last)?.closest?.(deleteSelector)
          range.setStartAfter(deleted && this.root.contains(deleted) ? deleted : last)
          range.collapse(true)
        }
      }
      this.insertTrackedText(range, text, meta)
    }, 'trackInsert')
  },
  trackedDelete(range, backward) {
    if (range.collapsed) return
    this.transaction(() => {
      const startBlock = closestBlock(this.root, range.startContainer)
      const endBlock = closestBlock(this.root, range.endContainer)
      const content =
        range.toString() || range.cloneContents().querySelector?.(atomicSelector.replace('br,', ''))
      if (!content && startBlock && endBlock && startBlock !== endBlock) {
        this.trackedJoin(endBlock, backward)
        return
      }
      const { first, last } = this.markDeleted(range)
      const anchor = backward ? first : last
      if (!anchor) return
      const caret = this.doc.createRange()
      const deleted = elementAt(anchor)?.closest?.(deleteSelector)
      const target =
        deleted && this.root.contains(deleted) && deleted.contains(anchor) ? deleted : anchor
      if (backward) {
        // Before the first deleted character, unless that is the start of a merged run.
        if (target === deleted && deleted.firstChild !== anchor) caret.setStartBefore(anchor)
        else caret.setStartBefore(target)
      } else if (target === deleted && deleted.lastChild !== anchor) caret.setStartAfter(anchor)
      else caret.setStartAfter(target)
      caret.collapse(true)
      selectRange(this.root, caret)
    }, 'trackDelete')
  },
  trackedJoin(block, backward) {
    if (
      block.getAttribute('data-studio-change') === 'split' &&
      this.ownChange(block, '[data-studio-change="split"]')
    ) {
      // Removing your own paragraph break suggestion simply merges the paragraphs back.
      const previous = block.previousElementSibling
      const offset = previous?.textContent.length || 0
      mergeIntoPrevious(block)
      if (previous) this.placeCaretAt(previous, offset)
      return
    }
    if (block.hasAttribute('data-studio-change')) return
    this.applyMeta(block, this.changeMeta('join'))
    if (backward) caretInside(this.root, block)
  },
  placeCaretAt(block, offset) {
    const walker = this.doc.createTreeWalker(block, 4)
    let remaining = offset
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (remaining <= text.length) {
        const caret = this.doc.createRange()
        caret.setStart(text, remaining)
        caret.collapse(true)
        selectRange(this.root, caret)
        return
      }
      remaining -= text.length
    }
    caretInside(this.root, block, true)
  },
  trackedSplit(range) {
    this.transaction(() => {
      if (!range.collapsed) {
        const { last } = this.markDeleted(range)
        if (last) {
          range.setStartAfter(elementAt(last)?.closest?.(deleteSelector) || last)
          range.collapse(true)
        }
      }
      const item = elementAt(range.startContainer)?.closest('li')
      const block = item || closestBlock(this.root, range.startContainer)
      if (!block || !mergeableBlocks.test(block.tagName) || block.tagName === 'PRE') {
        this.callbacks.onNotice(trackedNotice)
        return
      }
      const tailRange = this.doc.createRange()
      tailRange.setStart(range.startContainer, range.startOffset)
      tailRange.setEnd(block, block.childNodes.length)
      const tail = tailRange.extractContents()
      const next = this.doc.createElement(
        /^H[1-6]$/.test(block.tagName) && !tail.textContent ? 'p' : block.tagName,
      )
      if (block.style.textAlign) next.style.textAlign = block.style.textAlign
      next.append(tail)
      if (!next.textContent && !next.querySelector(atomicSelector.replace('br,', '')))
        next.innerHTML = '<br>'
      if (!block.textContent && !block.querySelector(atomicSelector.replace('br,', '')))
        block.innerHTML = '<br>'
      this.applyMeta(next, this.changeMeta('split'))
      block.after(next)
      caretInside(this.root, next)
    }, 'trackSplit')
  },
  /** beforeinput handler while tracking; returns true when the event was handled. */
  trackedInput(event) {
    if (!this.trackChanges) return false
    const type = event.inputType
    if (['historyUndo', 'historyRedo'].includes(type) || type.startsWith('insertComposition'))
      return false
    event.preventDefault()
    const target = event.getTargetRanges?.()[0]
    let range
    if (target) {
      range = this.doc.createRange()
      range.setStart(target.startContainer, target.startOffset)
      range.setEnd(target.endContainer, target.endOffset)
    } else range = currentRange(this.root)?.cloneRange()
    if (!range || !this.root.contains(range.commonAncestorContainer)) return true
    if (['insertText', 'insertReplacementText', 'insertFromYank'].includes(type)) {
      const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? ''
      if (text) this.trackedInsert(range, text)
    } else if (type === 'insertLineBreak') this.trackedInsert(range, '\n')
    else if (type === 'insertParagraph') this.trackedSplit(range)
    else if (type.startsWith('delete'))
      this.trackedDelete(range, /Backward/.test(type) || type === 'deleteByCut')
    else this.callbacks.onNotice(trackedNotice)
    return true
  },
  /** Composition cannot be cancelled; wrap the composed text once it is committed. */
  startTrackedComposition() {
    const range = currentRange(this.root)
    if (!this.trackChanges || !range) return
    if (!range.collapsed) {
      this.trackedDelete(range.cloneRange(), false)
      return this.startTrackedComposition()
    }
    const block = closestBlock(this.root, range.startContainer)
    this.composition = block ? { block, text: block.textContent } : null
  },
  finishTrackedComposition() {
    const composition = this.composition
    this.composition = null
    if (!this.trackChanges || !composition?.block.isConnected) return
    const step = diffText(composition.text, composition.block.textContent)
    if (!step.inserted) return
    const walker = this.doc.createTreeWalker(composition.block, 4)
    const points = []
    let offset = 0
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      for (const [index, position] of [step.from, step.from + step.inserted.length].entries())
        if (!points[index] && position >= offset && position <= offset + text.length)
          points[index] = [text, position - offset]
      offset += text.length
    }
    if (!points[0] || !points[1]) return
    const range = this.doc.createRange()
    range.setStart(...points[0])
    range.setEnd(...points[1])
    if (this.ownChange(range.startContainer, insertSelector)) return
    splitBoundaries(range)
    const meta = this.changeMeta('insert')
    let last = null
    for (const node of leafNodes(range)) {
      if (node.nodeType !== 3) continue
      const wrapper = this.changeElement('ins', meta)
      node.replaceWith(wrapper)
      wrapper.append(node)
      last = node
    }
    if (last) {
      const caret = this.doc.createRange()
      caret.setStart(last, last.length)
      caret.collapse(true)
      selectRange(this.root, caret)
    }
  },
  /** Find and replace as suggestions; text that is already suggested for deletion is skipped. */
  trackedReplaceMatches(query, replacement, all, sensitive, options) {
    let count = 0
    this.transaction((range) => {
      const candidates = this.matches(query, sensitive, options).filter(
        (match) => !elementAt(match.startContainer)?.closest(deleteSelector),
      )
      const matches = all
        ? candidates
        : candidates.filter(
            (match) =>
              match.compareBoundaryPoints(0, range) === 0 &&
              match.compareBoundaryPoints(2, range) === 0,
          )
      count = matches.length
      for (const match of matches.reverse()) {
        const meta = this.changeMeta('insert')
        const { last } = this.markDeleted(match, { ...meta, type: 'delete' })
        if (!last) continue
        const after = this.doc.createRange()
        after.setStartAfter(elementAt(last)?.closest?.(deleteSelector) || last)
        after.collapse(true)
        if (replacement) this.insertTrackedText(after, replacement, meta)
      }
    }, 'trackReplace')
    return count
  },
  trackedReplace(range, text) {
    if (!range || range.collapsed) return false
    this.trackedInsert(range, text)
    return true
  },
  trackedChanges() {
    const changes = new Map()
    for (const node of this.root.querySelectorAll(changeSelector)) {
      const id = node.getAttribute('data-studio-change-id') || ''
      const type = node.getAttribute('data-studio-change')
      if (!id || !['insert', 'delete', 'split', 'join'].includes(type)) continue
      const change = changes.get(id) || {
        id,
        type,
        author: node.getAttribute('data-studio-author') || '',
        authorName: node.getAttribute('data-studio-author-name') || '',
        time: node.getAttribute('data-studio-time') || '',
        inserted: '',
        deleted: '',
      }
      if (change.type !== type && ['insert', 'delete'].includes(type)) change.type = 'replace'
      if (type === 'insert') change.inserted += node.textContent
      if (type === 'delete') change.deleted += node.textContent
      if (['split', 'join'].includes(type)) change.inserted = node.textContent.slice(0, 120)
      changes.set(id, change)
    }
    return [...changes.values()].map((change) => ({
      ...change,
      inserted: change.inserted.slice(0, 500),
      deleted: change.deleted.slice(0, 500),
    }))
  },
  resolveChange(id, accept) {
    const matches = (node) => node.getAttribute('data-studio-change-id') === id
    if (!this.editable || ![...this.root.querySelectorAll(changeSelector)].some(matches))
      return false
    this.transaction(
      () => resolveChanges(this.root, accept, matches),
      accept ? 'acceptChange' : 'rejectChange',
    )
    return true
  },
  acceptChange(id) {
    return this.resolveChange(id, true)
  },
  rejectChange(id) {
    return this.resolveChange(id, false)
  },
  resolveAllChanges(accept) {
    if (!this.editable || !this.root.querySelector(changeSelector)) return false
    this.transaction(
      () => resolveChanges(this.root, accept),
      accept ? 'acceptChange' : 'rejectChange',
    )
    return true
  },
  focusChange(id) {
    const node = [...this.root.querySelectorAll(changeSelector)].find(
      (item) => item.getAttribute('data-studio-change-id') === id,
    )
    if (!node) return false
    const range = this.doc.createRange()
    range.selectNodeContents(node)
    this.root.focus({ preventScroll: true })
    selectRange(this.root, range)
    node.scrollIntoView?.({ block: 'center' })
    this.rememberSelection()
    this.publishState()
    return true
  },
}

/** Structural and formatting commands are refused while tracking. */
export const trackedMethods = new Set([
  'undo',
  'redo',
  'addComment',
  'updateComment',
  'suggestText',
  'resolveSuggestion',
  'copyFormat',
])
export function installTrackPolicy(prototype, methods) {
  for (const method of methods) {
    if (trackedMethods.has(method)) continue
    const original = prototype[method]
    prototype[method] = function (...args) {
      if (this.trackChanges) {
        this.callbacks.onNotice(trackedNotice)
        return false
      }
      return original.apply(this, args)
    }
  }
}
