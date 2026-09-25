import { mediaEmbedHtml, readMediaEmbed, parseMediaEmbed } from '../lib/media-embed.js'
import { selectRange, caretInside } from './selection'

export const mediaEmbeds = {
  selectEmbed(node) {
    if (!this.root.contains(node) || !readMediaEmbed(node)) return
    this.selectedEmbed = node
    this.root.focus({ preventScroll: true })
    const range = this.doc.createRange()
    range.selectNode(node)
    selectRange(this.root, range)
    this.selectionChanged()
  },
  insertEmbed(url, options) {
    if (!this.editable || !parseMediaEmbed(url)) return false
    this.transaction(
      (range) => this.insertFragment(`${mediaEmbedHtml(url, options)}<p><br></p>`, range),
      'insertEmbed',
    )
    return true
  },
  updateEmbed(node, url, options) {
    if (
      !this.editable ||
      !this.root.contains(node) ||
      !readMediaEmbed(node) ||
      !parseMediaEmbed(url)
    )
      return false
    this.transaction(() => {
      // Use the same sanitizer/rendering path as source edits and document loading.
      const template = this.doc.createElement('template')
      template.innerHTML = mediaEmbedHtml(url, options)
      const next = template.content.firstElementChild
      for (const attr of [...next.attributes]) node.setAttribute(attr.name, attr.value)
      const player = node.querySelector('iframe')
      const media = readMediaEmbed(next)
      if (player) {
        if (player.getAttribute('src') !== media.src) player.setAttribute('src', media.src)
        player.title = media.caption || media.provider
      }
      node.querySelector('figcaption')?.replaceWith(next.querySelector('figcaption'))
      this.selectEmbed(node)
    }, 'updateEmbed')
    return true
  },
  removeEmbed(node = this.context()?.closest('figure[data-studio-embed]')) {
    if (!this.editable || !node || !this.root.contains(node)) return
    this.transaction(() => {
      const paragraph = this.doc.createElement('p')
      paragraph.append(this.doc.createElement('br'))
      node.replaceWith(paragraph)
      caretInside(this.root, paragraph)
    }, 'removeEmbed')
  },
  embedKey(event) {
    const node = this.context()?.closest('figure[data-studio-embed]')
    if (!node) return false
    if (['Backspace', 'Delete'].includes(event.key)) {
      event.preventDefault()
      this.removeEmbed(node)
      return true
    }
    if (
      ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)
    ) {
      event.preventDefault()
      const before = ['ArrowUp', 'ArrowLeft'].includes(event.key)
      const neighbor = before ? node.previousElementSibling : node.nextElementSibling
      if (neighbor?.matches('p,h1,h2,h3,h4,h5,h6')) {
        caretInside(this.root, neighbor, before)
        this.selectionChanged()
      } else
        this.transaction(() => {
          const paragraph = this.doc.createElement('p')
          paragraph.append(this.doc.createElement('br'))
          node[before ? 'before' : 'after'](paragraph)
          caretInside(this.root, paragraph)
        }, 'exitEmbed')
      return true
    }
    return false
  },
}
