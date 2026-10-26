import { currentRange, selectRange, caretInside, elementAt, restore, unwrap } from './selection'
import { restoreBlockIds } from './identity.js'

// Restricted editing: authors mark editable regions; in restricted mode only those regions
// accept changes. Inline regions are spans, block regions are divs wrapping whole blocks.
export const regionSelector = '[data-studio-editable]'
export const validRegionName = (value) =>
  value === 'true' || /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value || '')
const restrictedNotice = 'Kısıtlı düzenleme: yalnızca vurgulu alanlar değiştirilebilir.'

/** The document with editable region contents removed: it must not change in restricted mode. */
export function lockedSignature(root) {
  const clone = root.cloneNode(true)
  for (const region of clone.querySelectorAll(regionSelector)) region.replaceChildren()
  return clone.innerHTML
}
function signatureOf(html, doc) {
  const template = doc.createElement('template')
  template.innerHTML = html
  const holder = doc.createElement('div')
  holder.append(template.content)
  return lockedSignature(holder)
}

export const restrictedEditing = {
  editableRegions() {
    return [...this.root.querySelectorAll(regionSelector)].filter(
      (node) =>
        validRegionName(node.dataset.studioEditable) && !node.parentElement.closest(regionSelector),
    )
  },
  regionAt(node) {
    const region = elementAt(node)?.closest?.(regionSelector)
    return region && this.root.contains(region) && region !== this.root ? region : null
  },
  /**
   * The body stays the only editing host, so document HTML never carries runtime attributes.
   * Input outside regions is refused in beforeinput and the commit guard catches the rest.
   */
  applyRestriction() {
    if (this.restricted) this.root.dataset.restricted = 'true'
    else delete this.root.dataset.restricted
  },
  setRestricted(enabled) {
    const restricted = !!enabled
    if (restricted === !!this.restricted) return
    if (this.composing && this.editable) {
      this.composing = false
      this.commit(this.before)
      this.before = null
    }
    this.restricted = restricted
    this.pending = null
    this.cellSelection = null
    this.applyRestriction()
    this.lockedState = restricted ? lockedSignature(this.root) : null
    this.publishState()
  },
  /** Called by commit(): reverts any change outside editable regions. */
  guardRestricted(before) {
    if (!this.restricted) return true
    const signature = lockedSignature(this.root)
    if (this.trustedChange || signature === this.lockedState) {
      this.lockedState = signature
      return true
    }
    const previous = before || this.history.current
    this.root.innerHTML = previous.html
    restoreBlockIds(this.root, previous.blockIds)
    this.applyRestriction()
    if (previous.selection) restore(this.root, previous.selection)
    this.pending = null
    this.callbacks.onNotice(restrictedNotice)
    this.publishState()
    return false
  },
  /** Undo/redo may not cross into states with different locked content. */
  restrictedSnapshotAllowed(snapshot) {
    return !this.restricted || signatureOf(snapshot.html, this.doc) === this.lockedState
  },
  restrictedInput(event) {
    if (!this.restricted) return true
    if (['historyUndo', 'historyRedo'].includes(event.inputType)) return true
    const ranges = event.getTargetRanges?.() || []
    const range = ranges[0] || currentRange(this.root)
    if (!range) return false
    const region = this.regionAt(range.startContainer)
    if (!region || region !== this.regionAt(range.endContainer)) {
      this.callbacks.onNotice(restrictedNotice)
      return false
    }
    if (['insertParagraph', 'insertLineBreak'].includes(event.inputType))
      return region.tagName === 'DIV'
    return !/^(insertFromDrop|deleteByDrag|insertReplacementText|formatSetBlockTextDirection)$/.test(
      event.inputType,
    )
  },
  /** Moves the caret to the next (or previous) editable region. */
  focusEditableRegion(backward = false) {
    const regions = this.editableRegions()
    if (!regions.length) return false
    const current = this.regionAt(currentRange(this.root)?.startContainer)
    let index = regions.indexOf(current)
    index =
      index < 0
        ? backward
          ? regions.length - 1
          : 0
        : (index + (backward ? -1 : 1) + regions.length) % regions.length
    const region = regions[index]
    this.root.focus({ preventScroll: true })
    const range = this.doc.createRange()
    range.selectNodeContents(region)
    selectRange(this.root, range)
    elementAt(region).scrollIntoView?.({ block: 'nearest' })
    this.rememberSelection()
    this.publishState()
    return true
  },
  markEditable(name = 'true') {
    if (this.restricted || !validRegionName(name)) return false
    let done = false
    this.transaction((range) => {
      if (this.regionAt(range.startContainer) || this.regionAt(range.endContainer)) return
      const topLevel = (node) => {
        let block = elementAt(node)
        while (block && block.parentNode !== this.root) block = block.parentNode
        return block
      }
      const first = topLevel(range.startContainer),
        last = topLevel(range.endContainer)
      if (!first || !last) return
      const inline =
        first === last &&
        !range.collapsed &&
        !/^(TABLE|UL|OL|FIGURE|HR)$/.test(first.tagName) &&
        !range
          .cloneContents()
          .querySelector('p,div,h1,h2,h3,h4,h5,h6,li,table,figure,blockquote,pre,ul,ol')
      if (inline || (range.collapsed && !/^(TABLE|UL|OL|FIGURE|HR)$/.test(first.tagName))) {
        const span = this.doc.createElement('span')
        span.dataset.studioEditable = name
        if (range.collapsed) span.textContent = name === 'true' ? '…' : name
        else span.append(range.extractContents())
        range.insertNode(span)
        const inside = this.doc.createRange()
        inside.selectNodeContents(span)
        selectRange(this.root, inside)
      } else {
        const blocks = []
        for (let node = first; node; node = node.nextSibling) {
          blocks.push(node)
          if (node === last) break
        }
        if (blocks.some((node) => node.querySelector?.(regionSelector))) return
        const wrapper = this.doc.createElement('div')
        wrapper.dataset.studioEditable = name
        first.before(wrapper)
        wrapper.append(...blocks)
        caretInside(this.root, wrapper)
      }
      done = true
    }, 'markEditable')
    return done
  },
  unmarkEditable() {
    if (this.restricted) return false
    const region = this.regionAt(currentRange(this.root)?.startContainer || this.context())
    if (!region) return false
    this.transaction(() => unwrap(region), 'unmarkEditable')
    return true
  },
  editableRegionValues() {
    return this.editableRegions().map((region) => ({
      name: region.dataset.studioEditable === 'true' ? '' : region.dataset.studioEditable,
      kind: region.tagName === 'DIV' ? 'block' : 'inline',
      text: region.textContent,
      html: region.innerHTML,
    }))
  },
}
