import { currentRange, closestBlock, selectRange, markRange } from './selection'
import { defaultWritingPreferences, defaultPen, penStyles } from '../lib/writing-preferences.js'

const protectedContent =
  'a,pre,code,[contenteditable="false"],[data-studio-thread],[data-studio-suggestion],sup[data-studio-footnote-ref]'
export const writingAssistance = {
  writingPreferences: null,
  permanentPen: null,
  penInput(event) {
    const pen = this.permanentPen || defaultPen()
    if (
      !pen.enabled ||
      event.inputType !== 'insertText' ||
      !event.data ||
      this.context()?.closest(protectedContent)
    )
      return false
    event.preventDefault()
    this.transaction((range) => {
      const span = this.doc.createElement('span')
      Object.assign(span.style, penStyles(pen))
      const text = this.doc.createTextNode(event.data)
      if (range.collapsed && range.startContainer === this.root) {
        const adjacent =
          this.root.childNodes[range.startOffset - 1] || this.root.childNodes[range.startOffset]
        if (
          adjacent?.matches?.('p,h1,h2,h3,h4,h5,h6') &&
          !adjacent.textContent &&
          !adjacent.querySelector('img,video,audio')
        ) {
          adjacent.replaceChildren()
          range.selectNodeContents(adjacent)
          range.collapse(true)
        }
      }
      const parent = (
        range.startContainer.nodeType === 1
          ? range.startContainer
          : range.startContainer.parentElement
      )?.closest('span')
      if (range.collapsed && parent?.style.cssText === span.style.cssText) {
        range.insertNode(text)
      } else {
        const selected = markRange(this.root, range, true)
        selected.range.deleteContents()
        span.append(text)
        selected.range.insertNode(span)
        selected.restore()
      }
      const caret = this.doc.createRange()
      caret.setStart(text, text.length)
      caret.collapse(true)
      selectRange(this.root, caret)
      text.parentElement.normalize()
    }, 'penTyping')
    this.autoCorrect(event)
    return true
  },
  autoCorrect(event) {
    const options = this.writingPreferences || defaultWritingPreferences()
    if (
      !options.enabled ||
      this.composing ||
      event.inputType !== 'insertText' ||
      !/^[ \u00a0]$/.test(event.data || '')
    )
      return false
    const caret = currentRange(this.root)
    if (!caret?.collapsed || this.context()?.closest(protectedContent)) return false
    const block = closestBlock(this.root, caret.startContainer)
    if (!block || block.textContent.length > 10000) return false
    const prefix = this.doc.createRange()
    prefix.selectNodeContents(block)
    prefix.setEnd(caret.startContainer, caret.startOffset)
    const text = prefix.toString(),
      match = text.match(/(?:^|\s)(\S{1,60})[ \u00a0]$/u)
    if (!match) return false
    const token = match[1]
    let value = options.rules.find((rule) => rule.from === token)?.to
    if (value === undefined && options.smartSymbols) {
      const symbols = {
        '(c)': '©',
        '(r)': '®',
        '(tm)': '™',
        '...': '…',
        '--': '—',
        '->': '→',
        '<-': '←',
      }
      if (Object.hasOwn(symbols, token)) value = symbols[token]
    }
    if (value === undefined || value === token) return false
    // Map the word across inline wrappers, including individual permanent-pen spans.
    const start = text.length - token.length - 1,
      end = text.length - 1
    const word = this.doc.createRange(),
      walker = this.doc.createTreeWalker(block, 4)
    let offset = 0,
      started = false,
      finished = false
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const next = offset + node.length
      if (next > start && offset < end && node.parentElement.closest(protectedContent)) return false
      if (!started && next > start) {
        word.setStart(node, start - offset)
        started = true
      }
      if (started && next >= end) {
        word.setEnd(node, end - offset)
        finished = true
        break
      }
      offset = next
    }
    if (!finished) return false
    this.transaction(() => {
      const saved = markRange(this.root, currentRange(this.root))
      word.deleteContents()
      const fragment = this.doc.createDocumentFragment()
      value.split(/\r?\n/).forEach((line, index) => {
        if (index) fragment.append(this.doc.createElement('br'))
        fragment.append(this.doc.createTextNode(line))
      })
      word.insertNode(fragment)
      saved.restore()
    }, 'autocorrect')
    return true
  },
}
